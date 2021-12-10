import INode from './INode'
import MindMap  from './mindmap';

export abstract class Command {
    name:string;
    mind?:any;
    constructor(name:string) {
        this.name = name;
    }
    execute(){}
    undo() {}
    redo() {
        this.execute();
    }
    refresh(mind?:any){
            var m = mind||this.mind;
            if(m){
                m.emit('renderEditNode',{});
                m.emit('mindMapChange',{});
            }
    }
}

export class AddNode extends Command {
    node:INode;
    parent:INode = null;
    mind:MindMap =null;
    index:number = -1;
    constructor(node:INode, parent:INode, mind?:MindMap) {
        super('addNode');
        this.node = node;
        this.parent = parent;
        this.mind = mind||this.node.mindmap;
    }
    execute() {
        if (this.index > -1) {
            this.mind.addNode(this.node, this.parent, this.index);   //add node to position of parent children
        } else {
            this.mind.addNode(this.node, this.parent);
        }
        this.node.refreshBox();
        this.refresh();
        this.mind.clearSelectNode();
        setTimeout(()=>{
            this.node.select();
            this.node.edit();
        },0);
    }

    undo() {
        var p = this.node.parent;
        this.index = this.mind.removeNode(this.node);
        this.mind.clearSelectNode();
        setTimeout(()=>{
            this.refresh();
            p&&p.select();
        },0)
    }
}


export class RemoveNode extends Command {
    node:INode;
    parent:INode = null;
    mind:MindMap =null;
    index:number = -1;
    constructor(node:INode, mind?:MindMap) {
        super('removeNode');
        this.node = node;
        this.parent = this.node.parent||null;
        this.mind = mind||this.node.mindmap;
    }
    execute() {
            this.node.clearCacheData();
            this.mind.clearSelectNode();
            this.index = this.mind.removeNode(this.node);
            this.refresh();
            this.parent && this.parent.select();
    }

    undo() {
        this.mind.addNode(this.node, this.parent, this.index);
        this.node.clearCacheData();
        this.node.refreshBox();
        this.mind.clearSelectNode();
        this.refresh();
        setTimeout(()=>{
            this.node.select();
        },0)
    }
}


export class ChangeNodeText extends Command {
    node:INode;
    oldText:string;
    text:string;
    isFirst:boolean;
    constructor(node:INode, oldText:string, text:string) {
        super('changeNodeText');
        this.node = node;
        this.oldText = oldText;
        this.text = text;
        this.isFirst =true;
    }
    execute() {
        if(!this.isFirst){
            this.node.setText(this.text);
        }
        this.node.refreshBox();
        this.node.clearCacheData();
        this.refresh(this.node.mindmap);
    }
    undo() {
        this.node.setText(this.oldText);
        this.node.clearCacheData();
        this.node.refreshBox();
        this.refresh(this.node.mindmap);
        this.isFirst =false;
    }
}

export class MoveNode extends Command {
    data:any={};
    node:INode;
    oldParent:INode;
    parent:INode;
    newParent?:INode;
    dropNode?:INode;
    type?:string;
    index:number = -1;
    constructor(data:any) {
        super('moveNode');
        this.data = data;
        if (this.data.type.indexOf('child') > -1) {
            this.node = this.data.node;
            this.oldParent = this.data.oldParent;
            this.parent = this.data.parent;
        } else {
            this.node = this.data.node;
            this.oldParent = this.node.parent;
            this.dropNode = this.data.dropNode;
            this.newParent = this.dropNode.parent;
            this.type = this.data.direct;
        }
    }

    execute() {
        this.node.mindmap.clearSelectNode();
        if (this.data.type.indexOf('child') > -1) {
            if (this.oldParent) {
                this.index = this.oldParent.removeChild(this.node)
            }
            this.parent.addChild(this.node);
            this.node.mindmap.traverseBF((n:INode) => {
                n.boundingRect = null;
                n.stroke = ''
            }, this.node);

            this.node.clearCacheData();
            this.oldParent.clearCacheData();
            this.refresh(this.node.mindmap);
            this.node.select();
        } else {

            if (this.oldParent) {
                this.index = this.oldParent.removeChild(this.node);
            }
            this.node.mindmap.traverseBF((n:INode) => {
                n.boundingRect = null;
                n.stroke = ''
            }, this.node);

            this.oldParent.clearCacheData();
            var dropNodeIndex = this.newParent.children.indexOf(this.dropNode);

            if (this.type == 'top' || this.type == 'left') {
                this.newParent.addChild(this.node, dropNodeIndex)
            }
            else {
                this.newParent.addChild(this.node, dropNodeIndex + 1);
            }

            this.node.clearCacheData();
            this.refresh(this.node.mindmap);
            this.node.select();
        }
    }

    undo() {
        this.node.mindmap.clearSelectNode();
        if (this.data.type.indexOf('child') > -1) {
            this.parent.removeChild(this.node);
            if (this.oldParent) {
                this.oldParent.addChild(this.node, this.index);
            }

            this.node.mindmap.traverseBF((n:INode) => {
                n.boundingRect = null;
                n.stroke = ''
            }, this.node);

            this.parent.clearCacheData();
            this.node.clearCacheData();
            this.refresh(this.node.mindmap);
            this.node.select();
        }
        else {
            this.newParent.removeChild(this.node);
            this.dropNode.clearCacheData();
            this.oldParent.addChild(this.node, this.index);
            this.node.clearCacheData();
            this.refresh(this.node.mindmap);
            this.node.select();
        }
    }
}


export class MovePos extends Command {
    node:INode;
    oldPos:any;
    newPos:any;
    constructor(node:INode, oldPos:any, newPos:any) {
        super('movePos');
        this.node = node;
        this.oldPos = oldPos;
        this.newPos = newPos;
    }

    execute() {
        this.node.setPosition(this.newPos.x, this.newPos.y);
        this.refresh(this.node.mindmap);
    }

    undo() {
        this.node.setPosition(this.oldPos.x, this.oldPos.y);
        this.refresh(this.node.mindmap);
    }
}

export class CollapseNode extends Command{
   node:INode;
   constructor(node:INode){
       super('collapseNOde')
       this.node = node;
       this.node.mindmap.clearSelectNode();
    
       this.node.refreshBox();
   }
   execute(){
       this.node.clearCacheData();
       this.node.collapse();
       this.refresh(this.node.mindmap);
       this.node.select();
   }
   undo(){
    this.node.clearCacheData();
    this.node.expand();
    this.refresh(this.node.mindmap);
    this.node.select();
   }
}

export class ExpandNode extends Command{
    node:INode;
    constructor(node:INode){
        super('collapseNOde')
        this.node = node;
        this.node.mindmap.clearSelectNode();
        this.node.refreshBox();
    }
    execute(){
        this.node.clearCacheData();
        this.node.expand();
        this.refresh(this.node.mindmap);
        this.node.select();
    }
    undo(){
     this.node.clearCacheData();
     this.node.collapse();
     this.refresh(this.node.mindmap);
     this.node.select();
    }
 }


 export class PasteNode extends Command {
    node:INode
    data:any
    waitCollapse:any[]=[]
    firstNode:INode
    constructor(node:any, data:any) {
        super('copyNode');
        this.node = node;
        this.data = data;
        this.mind= this.node.mindmap;
        this.waitCollapse = [];
    }

    execute() {
        this.paste();
    }

    undo() {
        if (this.firstNode) {
            this.mind.removeNode(this.firstNode);
            this.node.clearCacheData();
           // this.updateItems(this.node);
            this.refresh(this.node.mindmap);
        }
    }

    paste() {
        this.data.forEach((d:any, i:number) => {
          
            var n = new INode(d, this.mind);
          
            n.mindmap = this.mind;
            if (!d.isExpand) {
                this.waitCollapse.push(n);
            }
            if (i == 0) {
                n.data.pid = this.node.getId();
                this.mind.addNode(n, this.node);
                this.firstNode = n;
                n.setPosition(0,0);
                n.refreshBox();
              
            }
            else {
                var parent = this.mind.getNodeById(d.pid);
                if (parent) {
                   this.mind.addNode(n, parent);
                   n.setPosition(0,0);
                   n.refreshBox();

                }
            }
            
            if (i == this.data.length - 1) {
                n.clearCacheData();
                this.refresh(this.mind);
            }
        });
    }
}






