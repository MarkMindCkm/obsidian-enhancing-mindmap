import INode ,{ INodeData } from './INode'
import Layout from './Layout'
import {Notice, Platform} from 'obsidian'
import  SVG from 'svg.js'
import {MindMapView} from '../MindMapView'
import { frontMatterKey,basicFrontmatter } from '../constants';
import Exec from './Execute'


interface Setting{
    theme?:string;
    canvasSize?:number;
    background?:string;
    fontSize?:number;
    color?:string,
    exportMdModel?:string,
    headLevel:number,
    layoutDirect:string
}

export default class MindMap{
    root:INode;
    status:string;
    appEl:HTMLElement;
    contentEL:HTMLElement;
    containerEL:HTMLElement;
    path?:string;
    editNode?:INode;
    selectNode?:INode;
    setting:Setting;
    data:INodeData;
    drag?:boolean;
    startX?:number;
    startY?:number;
    dx?:number;
    dy?:number;
    mmLayout?:Layout;
    draw:any;
    edgeGroup:any;
    _nodeNum:number=0;
    _tempNum:number=0;
    view?:MindMapView;
    colors:string[]=[];
    _dragNode:INode;
    exec:Exec;
    scalePointer:number[]=[];
    mindScale = 100;
    timeOut:any = null;
    constructor( data:INodeData,containerEL:HTMLElement,setting?:Setting){
        this.setting = Object.assign({
            theme:'default',
            canvasSize:8000,
            fontSize:16,
            background:'transparent',
            color:'inherit',
            exportMdModel:'default',
            headLevel:2,
            layoutDirect:''
        },setting||{});

        
       this.data=data;
       this.appEl = document.createElement('div');
     
       this.appEl.classList.add('mm-mindmap');
       this.appEl.classList.add(`mm-theme-${this.setting.theme}`);
       this.appEl.style.overflow="auto";
      

       this.contentEL=document.createElement('div');
       this.contentEL.style.position="relative";
       this.contentEL.style.width="100%";
       this.contentEL.style.height="100%";
       this.appEl.appendChild(this.contentEL);
       this.draw = SVG(this.contentEL).size('100%', '100%');

       this.setAppSetting();
       containerEL.appendChild(this.appEl);
       this.containerEL = containerEL;

       //history
       this.exec = new Exec();

      // link line
       this.edgeGroup = this.draw.group();

       this.appClickFn=this.appClickFn.bind(this);
       this.appDragstart=this.appDragstart.bind(this);
       this.appDragend=this.appDragend.bind(this);
       this.appDragover=this.appDragover.bind(this);
       this.appDblclickFn=this.appDblclickFn.bind(this);
       this.appMouseOverFn=this.appMouseOverFn.bind(this);
       this.appDrop=this.appDrop.bind(this);
       this.appKeyup = this.appKeyup.bind(this);
       this.appKeydown = this.appKeydown.bind(this);
       this.appMousewheel = this.appMousewheel.bind(this);
       this.appMouseMove = this.appMouseMove.bind(this);

      //custom event
       this.initNode=this.initNode.bind(this);
       this.renderEditNode=this.renderEditNode.bind(this);
       this.mindMapChange=this.mindMapChange.bind(this);

       this.initEvent();
       //this.center();
    }

    setAppSetting(){
        this.appEl.style.width=`${this.setting.canvasSize}px`;
        this.appEl.style.height=`${this.setting.canvasSize}px`;
        this.contentEL.style.width=`100%`;
        this.contentEL.style.height=`100%`;
      //  this.contentEL.style.color=`${this.setting.color};`;
        this.contentEL.style.background=`${this.setting.background}`;
        this.contentEL.style.fontSize=`${this.setting.fontSize}px`;
    }
    //create node
    init(){
       var that=this;
       var data = this.data;
       var x = this.setting.canvasSize/2 - 60;
       var y = this.setting.canvasSize/2 - 200;
     
       function initNode(d:INodeData,isRoot:boolean,p?:INode){
           that._nodeNum ++;
           var n = new INode(d,that);
           that.contentEL.appendChild(n.containEl);
           if(isRoot){
             n.setPosition(x,y);
             that.root = n;
             n.isRoot = true;
           }else{
             n.setPosition(0,0);
             p.children.push(n);
             n.parent=p;
           }
           n.refreshBox();
           if(d.children && d.children.length){
               d.children.forEach((dd:INodeData)=>{
                initNode(dd,false,n);
               });
           }
       }
       initNode(data,true);
    }

    traverseBF(callback:Function, node?:INode) {
        var array = [];
        array.push(node|| this.root);
        var currentNode = array.shift();
        while (currentNode) {
            for (let i = 0, len = currentNode.children.length; i < len; i++) {
                array.push(currentNode.children[i]);
            }
            callback(currentNode);
            currentNode = array.shift();
        }
    }

    traverseDF(callback:Function, node?:INode,cbFirst?:boolean) {
        function recurse(currentNode:INode) {
            if (currentNode && currentNode.children) {
                if(cbFirst){
                    callback(currentNode);
                }
                for (var i = 0, length = currentNode.children.length; i < length; i++) {
                    recurse(currentNode.children[i]);
                }
                if(!cbFirst){
                    callback(currentNode);
                }
            }
        }
        recurse(node||this.root);
       
    }

    getNodeById(id:string){
        var snode:INode = null;
        this.traverseDF((n:INode)=>{
            if(n.getId()==id){
                snode = n;
            }
        });

        return snode;
    }

    clearSelectNode(){
        if(this.selectNode){
            this.selectNode.unSelect();
            this.selectNode=null
        }
        if(this.editNode){
            this.editNode.cancelEdit();
            this.editNode=null;
        }
    }
  

    initEvent(){
        this.appEl.addEventListener('click',this.appClickFn);
        this.appEl.addEventListener('mouseover',this.appMouseOverFn);
        this.appEl.addEventListener('dblclick',this.appDblclickFn);
        this.appEl.addEventListener('dragstart',this.appDragstart);
        this.appEl.addEventListener('dragover',this.appDragover);
        this.appEl.addEventListener('dragend',this.appDragend);
        this.appEl.addEventListener('drop',this.appDrop);
        document.addEventListener('keyup',this.appKeyup);
        document.addEventListener('keydown',this.appKeydown);
        this.appEl.addEventListener('mousemove',this.appMouseMove);
        document.body.addEventListener('mousewheel',this.appMousewheel);

        //custom event
        this.on('initNode',this.initNode);
        this.on('renderEditNode',this.renderEditNode);
        this.on('mindMapChange',this.mindMapChange);
        
    }

    removeEvent(){
        this.appEl.removeEventListener('click',this.appClickFn);
        this.appEl.removeEventListener('dragstart',this.appDragstart);
        this.appEl.removeEventListener('dragover',this.appDragover);
        this.appEl.removeEventListener('dragend',this.appDragend);
        this.appEl.removeEventListener('dblClick',this.appDblclickFn);
        this.appEl.removeEventListener('mouseover',this.appMouseOverFn);
        this.appEl.removeEventListener('drop',this.appDrop);
        document.removeEventListener('keyup',this.appKeyup);
        document.removeEventListener('keydown',this.appKeydown);
        this.appEl.removeEventListener('mousemove',this.appMouseMove);
        document.body.removeEventListener('mousewheel',this.appMousewheel);


        this.off('initNode',this.initNode);
        this.off('renderEditNode',this.renderEditNode);
        this.off('mindMapChange',this.mindMapChange);
    }

    initNode(evt:CustomEvent){
        this._tempNum++;
        //console.log(this._nodeNum,this._tempNum);

        if(this._tempNum == this._nodeNum){
            this.refresh();
            this.center();
        }
    }

    renderEditNode(evt:CustomEvent){
        var node = evt.detail.node||null;
        node?.clearCacheData();
        this.refresh();
        
    }

    mindMapChange(){
        //console.log(this.view)
        this.view?.mindMapChange();
    }

    appKeydown(e:KeyboardEvent){
       
        var keyCode = e.keyCode || e.which || e.charCode;
        var ctrlKey = e.ctrlKey || e.metaKey;
        var shiftKey = e.shiftKey;
        if(!ctrlKey&&!shiftKey){
            // tab
            if (keyCode == 9 || keyCode == 45) {
                e.preventDefault();
                e.stopPropagation();
            }

            if(keyCode == 32){
                var node = this.selectNode;
                if (node && !node.isEdit) {
                    e.preventDefault();
                    e.stopPropagation();
                    node.edit();
                }
            }
        }


        if(ctrlKey && !shiftKey){
            //ctrl + y
            if(keyCode == 89){
                e.preventDefault();
                e.stopPropagation();
                this.redo();
            }

            //ctrl + z
            if(keyCode == 90){
                 e.preventDefault();
                 e.stopPropagation();
                 this.undo();
            }

        }
    }

    appKeyup(e:KeyboardEvent){
        var keyCode = e.keyCode || e.which || e.charCode;
        var ctrlKey = e.ctrlKey || e.metaKey;
        var shiftKey = e.shiftKey;
        if(!ctrlKey&&!shiftKey){
            //enter 
            if(keyCode == 13){
                var node = this.selectNode;
                if(node&&!node.isEdit){
                     e.preventDefault();
                     e.stopPropagation();
                     if(!node.isExpand){
                        node.expand();
                     }
                     if(!node.parent) return;
                     node.mindmap.execute('addSiblingNode',{
                         parent:node.parent
                     });
                 }
            }

            //delete
            if (keyCode == 46) {
                var node = this.selectNode;
                if (node&&!node.isEdit) {
                 e.preventDefault();
                 e.stopPropagation();
                 node.mindmap.execute("deleteNodeAndChild", { node });
                }
            }

            //tab
            if (keyCode == 9 || keyCode == 45) {
                e.preventDefault();
                e.stopPropagation();
                var node = this.selectNode;
                if (node && !node.isEdit) {
                    if(!node.isExpand){
                        node.expand();
                    }
                    node.mindmap.execute("addChildNode", { parent: node });
                }else if(node && node.isEdit){
                    node.cancelEdit();
                    node.select();
                }
            }

           // up
           if(keyCode == 38 ){
              var node = this.selectNode;
              if (node&&!node.isEdit) {
                this._selectNode(node, "up");
              }
           }

           if(keyCode == 40 ){
            var node = this.selectNode;
             if (node&&!node.isEdit) {
                this._selectNode(node, "down");
             }
          }

          if(keyCode == 39 ){
            var node = this.selectNode;
             if (node&&!node.isEdit) {
                this._selectNode(node, "right");
             }
          }

          if(keyCode == 37 ){
            var node = this.selectNode;
             if (node&&!node.isEdit) {
               this._selectNode(node, "left");
             }
          }       
           
        }


        if(ctrlKey && !shiftKey){
            //ctr + /  toggle expand node
            if(keyCode == 191){
                var node = this.selectNode;
                if (node&&!node.isEdit) {
                   if(node.isExpand){
                       node.mindmap.execute('collapseNode',{
                           node
                       })
                   }else{
                        node.mindmap.execute('expandNode',{
                             node
                        })
                   }
                }
           }

           // ctrl + E  center
           if(keyCode == 69){
               this.center();
           }
        }
    }

    _selectNode(node:INode, direct:string) {
        if (!node) {
          return;
        }

        var minDis:number;
        var waitNode:INode = null;
        var pos = node.getPosition();
        var mind = this;
        

        mind.traverseDF((n:INode) => {
          var p = n.getPosition();
          var dx = Math.abs(p.x - pos.x);
          var dy = Math.abs(p.y - pos.y);
          var dis = Math.sqrt(dx * dx + dy * dy);
          switch (direct) {
            case "right":
              if (p.x > pos.x) {
                if (minDis) {
                  if (minDis > dis) {
                    minDis = dis;
                    waitNode = n;
                  }
                } else {
                  minDis = dis;
                  waitNode = n;
                }
              }
              break;
            case "left":
              if (p.x < pos.x) {
                if (minDis) {
                  if (minDis > dis) {
                    minDis = dis;
                    waitNode = n;
                  }
                } else {
                  minDis = dis;
                  waitNode = n;
                }
              }
              break;
            case "up":
              if (p.y < pos.y) {
                if (minDis) {
                  if (minDis > dis) {
                    minDis = dis;
                    waitNode = n;
                  }
                } else {
                  minDis = dis;
                  waitNode = n;
                }
              }
              break;
            case "down":
              if (p.y > pos.y) {
                if (minDis) {
                  if (minDis > dis) {
                    minDis = dis;
                    waitNode = n;
                  }
                } else {
                  minDis = dis;
                  waitNode = n;
                }
              }
              break;
          }
        });
        
        if(waitNode){
            mind.clearSelectNode();
            waitNode.select();
        }
    }

    appClickFn(evt:MouseEvent){
        var targetEl = evt.target as HTMLElement;

       if(targetEl){

           if (targetEl.tagName=='A'&&targetEl.hasClass("internal-link")) {
            evt.preventDefault();
            var targetEl =evt.target as HTMLElement;
             this.view.app.workspace.openLinkText(
                targetEl.getAttr("href"),
                this.view.file.path,
                evt.ctrlKey || evt.metaKey
              );
          }

          if(targetEl.hasClass('mm-node-bar')){
                evt.preventDefault();
                evt.stopPropagation();
                var id = targetEl.closest('.mm-node').getAttribute('data-id');
                var node = this.getNodeById(id);
              
                if(node.isExpand){
                    node.mindmap.execute('collapseNode',{
                        node
                    });
                }else{
                    node.mindmap.execute('expandNode',{
                        node
                    });
                }
               return
           }
           
           if(targetEl.closest('.mm-node')){
               var id = targetEl.closest('.mm-node').getAttribute('data-id');
               var node = this.getNodeById(id);
               if(!node.isSelect){
                  this.clearSelectNode();
                  this.selectNode=node;
                  this.selectNode?.select();
                
               }
           }else{
              this.clearSelectNode();
           }
       }
    }

    appDragstart(evt:MouseEvent){
        evt.stopPropagation();
        this.startX = evt.pageX;
        this.startY = evt.pageY;
        if(evt.target instanceof HTMLElement){
            if(evt.target.closest('.mm-node')){
                var id = evt.target.closest('.mm-node').getAttribute('data-id');
                this._dragNode = this.getNodeById(id);
                this.drag=true;
            }
        }
    }

    appDragend(evt:MouseEvent){
        this.drag=false;
    }

    appDragover(evt:MouseEvent){
        evt.preventDefault();
        evt.stopPropagation();
        if(this.drag){
             this.dx = evt.pageX - this.startX;
             this.dx = evt.pageY - this.startY;
        }
    }

    appDrop(evt:MouseEvent){
        if(evt.target instanceof HTMLElement){
            if(evt.target.closest('.mm-node')){
                 evt.preventDefault();
                 var dropNodeId = evt.target.closest('.mm-node').getAttribute('data-id');
                 var dropNode =   this.getNodeById(dropNodeId);
                 if(this._dragNode.isRoot){

                 }else{
                     this.moveNode(this._dragNode,dropNode);
                 }
            }
        }
    }

    appMouseOverFn(evt:MouseEvent){
        const targetEl = evt.target as HTMLElement;

        if (targetEl.tagName !== "A") return;
  
        if (targetEl.hasClass("internal-link")) {
          this.view.app.workspace.trigger("hover-link", {
            event: evt,
            source: frontMatterKey,
            hoverParent: this.view,
            targetEl,
            linktext: targetEl.getAttr("href"),
            sourcePath: this.view.file.path,
          });
        }
    }

    appMouseMove(evt:MouseEvent){
        const targetEl = evt.target as HTMLElement;
        this.scalePointer=[];
        this.scalePointer.push(evt.offsetX,evt.offsetY);
        if(targetEl.closest('.mm-node')){
              var id = targetEl.closest('.mm-node').getAttribute('data-id');
              var node = this.getNodeById(id);
              if(node){
                  var box = node.getBox();
                  this.scalePointer = [];
                  this.scalePointer.push(box.x+box.width/2,box.y+box.height/2);
              }
        }
    }

    appDblclickFn(evt:MouseEvent){
        if(evt.target instanceof HTMLElement){
            
            if(evt.target.hasClass('mm-node-bar')){
                evt.preventDefault();
                evt.stopPropagation();
                return;
            }
            if(evt.target.closest('.mm-node') instanceof HTMLElement){
                var id = evt.target.closest('.mm-node').getAttribute('data-id');
                this.selectNode = this.getNodeById(id);
                if(!this.editNode||(this.editNode&&this.editNode!=this.selectNode)){
                  this.selectNode?.edit();
                  this.editNode = this.selectNode;
               }
            }
        }
    }

    appMousewheel(evt:any){
      // if(!evt) evt = window.event;
        var ctrlKey = evt.ctrlKey || evt.metaKey;
        var delta ;
        if (evt.wheelDelta) {
            //IE、chrome  -120
              delta = evt.wheelDelta / 120;
          } else if (evt.detail) {
            //FF 3
            delta = -evt.detail / 3;
          }

          if (delta) {
            if (delta < 0) {
              if (ctrlKey) {
                this.setScale("down");
              }
            } else {
              if (ctrlKey) {
                this.setScale("up");
              }
            }
          }
    }

    clearNode(){
        //delete node
        this.traverseBF((n:INode)=>{
            this.contentEL.removeChild(n.containEl);
        });
        
        //delete line
        if(this.mmLayout){
            this.mmLayout.svgDom?.clear();
        }

    }

    clear(){
        this.clearNode();
        this.removeEvent();
        this.draw?.clear();
    }
    //get node list rect point
    getBoundingRect(list:INode[]){
            var box = {
                x:0,
                y:0,
                width:0,
                height:0,
                right:0,
                bottom:0
            };
            list.forEach((item, i) => {
              var b = item.getBox();
                if (i == 0) {
                    box.x = b.x;
                    box.y = b.y;
                    box.right = b.x + b.width;
                    box.bottom = b.y + b.height;
                } else {
                    if (b.x < box.x) {
                        box.x = b.x
                    }
                    if (b.y < box.y) {
                        box.y = b.y
                    }
                    if (b.x + b.width > box.right) {
                        box.right = b.x + b.width;
                    }
                    if (b.y + b.height > box.bottom) {
                        box.bottom = b.y + b.height;
                    }
                }
            });

            box.width = box.right - box.x;
            box.height = box.bottom - box.y;

            return box;
    }

    moveNode(dragNode:INode,dropNode:INode){
      
        if(dragNode == dropNode||dragNode.isRoot){
           return
        }

        var flag = false;
        var p = dropNode.parent;
        while (p) {
            if (p == dragNode) {
                flag = true;
                break;
            }
            p = p.parent;
        }
        if (flag) {  //parent  can not change to child
            return;
        }

        dropNode.clearCacheData();
        dragNode.clearCacheData();

        if (!dropNode.isExpand) {
            dropNode.expand();
        }

         this.execute('moveNode', { type: 'child', node: dragNode, oldParent: dragNode.parent, parent: dropNode })
    }
    
    //execute cmd , store history
    execute(name:string,data?:any){
        this.exec.execute(name,data);
    }
    undo(){
        this.exec.undo();
    }

    redo(){
        this.exec.redo();
    }

    addNode(node:INode, parent?:INode, index = -1) {
        if (parent) {
            parent.addChild(node, index);
            if (parent.direct) {
                node.direct = parent.direct;
            }
            this._addNodeDom(node);
            node.clearCacheData();
        }
    }

    _addNodeDom(node:INode) {
        this.traverseBF((n:INode) => {
            if (!this.contentEL.contains(n.containEl)) {
                this.contentEL.appendChild(n.containEl);
            }
        }, node);
    }

    removeNode(node:INode) {
        if (node.parent) {
            var p = node.parent;
            var i = node.parent.removeChild(node);
            this._removeChildDom(node);
            p.clearCacheData();
            return i;
        } else {
            this._removeChildDom(node);
            return -1;
        }

    }

    _removeChildDom(node:INode) {
        this.traverseBF((n:INode) => {
            if (this.contentEL.contains(n.containEl)) {
                this.contentEL.removeChild(n.containEl);
            }
        }, node);
    }

    //layout
    layout(){
        if(!this.mmLayout){
            this.mmLayout = new Layout(this.root,'mind map',this.colors);
            return;
        }

        this.mmLayout.layout(this.root,this.setting.layoutDirect||this.mmLayout.direct||'mind map');
    }

    refresh(){
        this.layout();
    }

    emit(name:string, data?:any) {
        var evt = new CustomEvent(name, {
            detail: data||{}
        });
        this.appEl.dispatchEvent(evt);
    }

    on(name:string, fn:any) {
        this.appEl.addEventListener(name, fn);
    }

    off(name:string, fn:any) {
        if (name && fn) {
            this.appEl.removeEventListener(name, fn);
        }
    }

    center(){
        this._setMindScalePointer();
        var oldScale = this.mindScale;
        this.scale(100);

        var w = this.containerEL.clientWidth;
        var h= this.containerEL.clientHeight;
        this.containerEL.scrollTop = this.setting.canvasSize/2 - h/2 - 60 ;
        this.containerEL.scrollLeft = this.setting.canvasSize/2 - w/2 + 30;

        this.scale(oldScale);
    }

    _setMindScalePointer(){
            this.scalePointer=[]; 
            var root = this.root;
            if(root){
                var rbox = root.getBox();
                this.scalePointer.push(rbox.x+rbox.width/2,rbox.y+rbox.height/2);
            }
    }

    getMarkdown(){
        var md = '';
        var level = this.setting.headLevel||2;
        this.traverseDF((n:INode)=>{
             var l = n.getLevel() + 1;
             var hPrefix = '', space = '';
             if(l>1){
                hPrefix='\n';
             }
             if(n.getLevel()<level){
                for(let i = 0;i<l;i++){
                    hPrefix += '#';
                }
                md += (hPrefix+' ');
                md += n.getData().text.trim() + '\n';
               
             }else{
                for(var i=0;i<n.getLevel()-level;i++){
                  space +='   ';
                }
                var text = n.getData().text.trim();
                if(text){
                    var textArr=text.split('\n');
                    var lineLength = textArr.length;
                    
                    if(lineLength==1){
                        md+= `${space}- ${text}\n`;
                    }else if(lineLength>1){
                        //code
                        if(text.startsWith('```')){
                            md+=`${space}-\n`;
                            textArr.forEach((t:string,i:number)=>{
                                md +=`${space}  ${t.trim()}\n`
                            });
                        }else{
                          //text
                           md+=`${space}- `;
                           textArr.forEach((t:string,i:number)=>{
                               if(i>0){
                                md +=`${space}   ${t.trim()}\n`
                               }else{
                                md +=`${t.trim()}\n`
                               }
                           });
                        }
                      
                    }
                }else{
                    md+= `-\n`;
                }
             }
        },this.root,true);
        return md.trim();
    }
    scale(num:number) {
        if (num < 20) {
          num = 20;
        }
        if (num > 300) {
          num = 300;
        }
        this.mindScale = num;
          if (this.scalePointer.length) {
            this.appEl.style.transformOrigin = `${this.scalePointer[0]}px ${this.scalePointer[1]}px`;
            this.appEl.style.transform = "scale(" + this.mindScale / 100 + ")";
          } else {
            this.appEl.style.transform = "scale(" + this.mindScale / 100 + ")";
          }
         
      }

      setScale(type:string) {
        if (type == "up") {
          var n = this.mindScale + 10;
        } else {
          var n = this.mindScale - 10;
        }
        this.scale(n);

        if(this.timeOut){
            clearTimeout(this.timeOut)
        }
        
        this.timeOut = setTimeout(()=>{
            new Notice(`${n} %`);
        },600);
      }

}