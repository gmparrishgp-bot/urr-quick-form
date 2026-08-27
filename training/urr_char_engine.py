"""Train/evaluate the lightweight URR handwriting engine.

Architecture:
- EMNIST Balanced supplies real handwritten character shapes (digits + letters).
- A small CNN is trained for browser deployment.
- URR fields are segmented before recognition, so numeric fields use a restricted
  alphabet and description fields use RV vocabulary correction downstream.
- Real URR fixtures are holdout regression data and are not training labels.
"""
from __future__ import annotations
import argparse, json, os, random
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms

ROOT = Path(os.environ.get("URR_DATA", ".urr-data"))
ART = Path("training/artifacts")
ART.mkdir(parents=True, exist_ok=True)

class CharCNN(nn.Module):
    def __init__(self, n: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 96, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d((4,4)), nn.Flatten(),
            nn.Linear(96*4*4, 192), nn.ReLU(), nn.Dropout(.15), nn.Linear(192,n)
        )
    def forward(self,x): return self.net(x)

def make_ds(train: bool):
    ops=[
        transforms.ToTensor(),
        # torchvision EMNIST is stored rotated/transposed. This makes glyphs upright.
        transforms.Lambda(lambda x: x.transpose(1,2).flip(2)),
    ]
    if train:
        ops.append(transforms.RandomAffine(8, translate=(.08,.08), scale=(.88,1.12), shear=7))
    ops.append(transforms.Normalize((.5,),(.5,)))
    return datasets.EMNIST(ROOT, split="balanced", train=train, download=True, transform=transforms.Compose(ops))

def train(args):
    random.seed(args.seed); torch.manual_seed(args.seed)
    train_full=make_ds(True); test_full=make_ds(False)
    classes=train_full.classes
    n=len(classes)
    ds=train_full; test=test_full
    if args.max_train and args.max_train < len(ds):
        idx=torch.randperm(len(ds), generator=torch.Generator().manual_seed(args.seed))[:args.max_train].tolist()
        ds=Subset(ds,idx)
    if args.max_test and args.max_test < len(test):
        test=Subset(test,list(range(args.max_test)))
    model=CharCNN(n)
    opt=torch.optim.AdamW(model.parameters(),lr=args.lr,weight_decay=1e-4)
    lossfn=nn.CrossEntropyLoss(label_smoothing=.03)
    dl=DataLoader(ds,batch_size=args.batch,shuffle=True,num_workers=2)
    for ep in range(args.epochs):
        model.train(); seen=correct=0; total=0.0
        for x,y in dl:
            opt.zero_grad(); z=model(x); loss=lossfn(z,y); loss.backward(); opt.step()
            total += loss.item()*len(y); seen += len(y); correct += (z.argmax(1)==y).sum().item()
        print(json.dumps({"epoch":ep+1,"train_loss":total/seen,"train_acc":correct/seen}))
    model.eval(); seen=correct=0
    with torch.no_grad():
        for x,y in DataLoader(test,batch_size=args.batch,num_workers=2):
            z=model(x); seen += len(y); correct += (z.argmax(1)==y).sum().item()
    acc=correct/seen
    print(json.dumps({"holdout_acc":acc,"samples":seen}))
    torch.save({"state":model.state_dict(),"classes":classes},ART/'urr-char.pt')
    dummy=torch.zeros(1,1,28,28)
    torch.onnx.export(model,dummy,ART/'urr-char.onnx',input_names=['image'],output_names=['logits'],dynamic_axes={'image':{0:'batch'},'logits':{0:'batch'}},opset_version=17)
    (ART/'urr-char-classes.json').write_text(json.dumps(classes))
    (ART/'metrics.json').write_text(json.dumps({"holdout_acc":acc,"train_samples":len(ds),"test_samples":seen},indent=2))
    if acc < args.min_acc: raise SystemExit(f"holdout accuracy {acc:.4f} < gate {args.min_acc:.4f}")

def main():
    p=argparse.ArgumentParser(); p.add_argument('--epochs',type=int,default=3); p.add_argument('--batch',type=int,default=256)
    p.add_argument('--lr',type=float,default=2e-3); p.add_argument('--seed',type=int,default=199)
    p.add_argument('--max-train',type=int,default=160000); p.add_argument('--max-test',type=int,default=20000)
    p.add_argument('--min-acc',type=float,default=.86); args=p.parse_args(); train(args)
if __name__=='__main__': main()
