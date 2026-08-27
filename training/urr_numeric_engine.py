"""Train a dedicated numeric recognizer for URR RO, parts, and labor fields."""
from __future__ import annotations
import argparse, json, os, random
from pathlib import Path
import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

ROOT=Path(os.environ.get('URR_DATA','.urr-data')); ART=Path('training/artifacts');ART.mkdir(parents=True,exist_ok=True)

class DigitCNN(nn.Module):
    def __init__(self):
        super().__init__();self.net=nn.Sequential(
            nn.Conv2d(1,32,3,padding=1),nn.ReLU(),nn.MaxPool2d(2),
            nn.Conv2d(32,64,3,padding=1),nn.ReLU(),nn.MaxPool2d(2),
            nn.Conv2d(64,96,3,padding=1),nn.ReLU(),nn.MaxPool2d(2),nn.Flatten(),
            nn.Linear(96*3*3,128),nn.ReLU(),nn.Dropout(.10),nn.Linear(128,10))
    def forward(self,x):return self.net(x)

def make(train):
    ops=[transforms.ToTensor()]
    if train:ops.append(transforms.RandomAffine(10,translate=(.10,.10),scale=(.82,1.18),shear=9))
    ops.append(transforms.Normalize((.5,),(.5,)))
    return datasets.MNIST(ROOT,train=train,download=True,transform=transforms.Compose(ops))

def main():
    p=argparse.ArgumentParser();p.add_argument('--epochs',type=int,default=2);p.add_argument('--batch',type=int,default=256);p.add_argument('--min-acc',type=float,default=.975);a=p.parse_args()
    random.seed(199);torch.manual_seed(199);tr=make(True);te=make(False);m=DigitCNN();opt=torch.optim.AdamW(m.parameters(),lr=2e-3);lossfn=nn.CrossEntropyLoss()
    for ep in range(a.epochs):
        m.train();seen=ok=0;losses=0
        for x,y in DataLoader(tr,batch_size=a.batch,shuffle=True,num_workers=2):
            opt.zero_grad();z=m(x);loss=lossfn(z,y);loss.backward();opt.step();seen+=len(y);ok+=(z.argmax(1)==y).sum().item();losses+=loss.item()*len(y)
        print(json.dumps({'numeric_epoch':ep+1,'loss':losses/seen,'acc':ok/seen}))
    m.eval();seen=ok=0
    with torch.no_grad():
        for x,y in DataLoader(te,batch_size=a.batch,num_workers=2):z=m(x);seen+=len(y);ok+=(z.argmax(1)==y).sum().item()
    acc=ok/seen;print(json.dumps({'numeric_holdout_acc':acc,'samples':seen}))
    dummy=torch.zeros(1,1,28,28)
    torch.onnx.export(m,dummy,ART/'urr-numeric.onnx',input_names=['image'],output_names=['logits'],dynamic_axes={'image':{0:'batch'},'logits':{0:'batch'}},opset_version=17,dynamo=False)
    (ART/'numeric-metrics.json').write_text(json.dumps({'holdout_acc':acc,'samples':seen},indent=2))
    if acc<a.min_acc:raise SystemExit(f'numeric holdout accuracy {acc:.4f} < {a.min_acc:.4f}')
if __name__=='__main__':main()
