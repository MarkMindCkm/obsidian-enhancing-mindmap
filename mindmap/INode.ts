import MindMap from './mindmap' 
import {MarkdownRenderer,normalizePath,TFile} from 'obsidian'
import {t} from '../lang/helpers'


export function keepLastIndex(dom:HTMLElement) {
    if ( window.getSelection ) { //ie11 10 9 ff safari
        dom.focus();  //ff
        var range = window.getSelection();
        range.selectAllChildren(dom); 
        range.collapseToEnd(); 
    }
    // else if ( document.selection ) { //ie10 9 8 7 6 5
    //     var range = document.selection.createRange(); 
    //     range.moveToElementText(dom);
    //     range.collapse(false);
    //     range.select();
    // }
};

interface INode {
    id: string;
    text: string;
    pid?:string;
    mdText?:string;
    isRoot?:Boolean;
    children?:INode[];
}

interface BOX {
    x: number;
    y: number;
    width:number;
    height:number;
    right?:number;
    bottom?:number;
}

export class INodeData implements INode{
    id:string;
    text:string;
    pid?:string;
    mdText?:string;
    isRoot?:Boolean;
    children?:INodeData[]
}

export default class Node {
    containEl:HTMLElement;
    contentEl:HTMLElement;
    box:BOX = {
        x:0,
        y:0,
        width:0,
        height:0
    };
    mindmap:MindMap;
    isExpand:boolean=true;
    isSelect:boolean = false;
    _oldText?:string;
    parent?:Node;
    isRoot?:boolean;
    children:Node[]=[];
    boundingRect:any;
    direct?:string;
    isHide:boolean=false;
    stroke?:string;
    isEdit:boolean=false;
    _barDom:HTMLElement=null;
    constructor(private data:INode,mindMap?:MindMap){
      
       this.mindmap = mindMap;
       this.initDom();
    }

    getId(){
        return this.data.id;
    }

    initDom(){
        this.containEl = document.createElement('div');
        this.containEl.classList.add('mm-node');
        this.containEl.setAttribute('contentEditable','false');
        this.containEl.setAttribute('tabIndex','-1');
        this.containEl.setAttribute('data-id',this.data.id);
        this.containEl.setAttribute('draggable','false');

        this.contentEl = document.createElement('div');
        this.contentEl.classList.add('mm-node-content');
        this.containEl.appendChild(this.contentEl);
        //this.containEl.textContent = this.data.text;
        this.initNodeBar();

        if(this.data.isRoot){
            this.containEl.classList.add('mm-root');
            this.isRoot = true;
        }

        this.parseText();
    }

    initNodeBar(){
        this._barDom = document.createElement('div')
        this._barDom.classList.add('mm-node-bar');
        this.containEl.appendChild(this._barDom);
    }

    parseText(){
       
        MarkdownRenderer.renderMarkdown( this.data.text ,this.contentEl,this.mindmap.path||"",null).then(()=>{
            this.data.mdText = this.contentEl.innerHTML;
            this.refreshBox();
            this.mindmap&&this.mindmap.emit('initNode',{});
            this._delay();
        });
        
    }

    _delay(){
         //parse image
         this.contentEl.findAll(".internal-embed").forEach((el) => {
            const src = el.getAttribute("src");
            const target =
              typeof src === "string" &&
              this.mindmap&&this.mindmap.view?.app.metadataCache.getFirstLinkpathDest(src, this.mindmap.path);
            if (target instanceof TFile && target.extension !== "md" && this.mindmap) {
              el.innerText = "";
              el.createEl(
                "img",
                { attr: { src: this.mindmap.view.app.vault.getResourcePath(target) } },
                (img) => {
                  if (el.hasAttribute("width"))
                    img.setAttribute("width", el.getAttribute("width"));
                  if (el.hasAttribute("alt"))
                    img.setAttribute("alt", el.getAttribute("alt"));
                }
              );
              el.addClasses(["image-embed", "is-loaded"]);
            }
          });
          
        //Possible causes of delay,code mathjax  
        var dom =this.contentEl.querySelector('code')|| this.contentEl.querySelector('.MathJax');
        if(dom){
            setTimeout(()=>{
                this.clearCacheData();
                this.refreshBox();
                this.mindmap&&this.mindmap.emit('renderEditNode',{});
            },100);
        }
        //image 
        this.contentEl.querySelectorAll('img').forEach(element => {
            element.onload = () => {
                    this.clearCacheData();
                    this.refreshBox();
                    this.mindmap&&this.mindmap.emit('renderEditNode',{});
            }
            element.onerror = () => {
                    this.clearCacheData();
                    this.refreshBox();
                    this.mindmap&&this.mindmap.emit('renderEditNode',{});
            }

            element.setAttribute('draggble','false');
        });
    }

    select(){
        this.isSelect = true;
        this.containEl.setAttribute('draggable','true');
        Object.assign(window,{
            myNode:this
        });
        if(!this.containEl.classList.contains('mm-node-select')){
            this.containEl.classList.add('mm-node-select')
        }
        this.mindmap.selectNode=this;
    }

    unSelect(){
        this.isSelect = false;
        this.containEl.setAttribute('draggable','false');
        if(this.containEl.classList.contains('mm-node-select')){
            this.containEl.classList.remove('mm-node-select')
        }
    }

    edit(){
        this.contentEl.innerText='';
        this._oldText = this.data.text;
        var _t =  this.data.text.replace(/\r\n/g,"<br/>")
        _t = _t.replace(/\n/g,"<br/>");
        this.contentEl.innerHTML = _t;
        this.contentEl.setAttribute('contentEditable','true');
        this.contentEl.focus();
        this.mindmap.editNode = this;
        this.isEdit = true;
        keepLastIndex(this.contentEl);
     
        if (this.contentEl.innerText == t('Sub title')) {
            this.selectText();
        }
        
    }

    selectText() {
        var text = this.contentEl;
        // if (document.body.createTextRange) {
        //     var range = document.body.createTextRange();
        //     range.moveToElementText(text);
        //     range.select();
        // } 
        if (window.getSelection) {
            var selection = window.getSelection();
            var range = document.createRange();
            range.selectNodeContents(text);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    cancelEdit(){
        var text = this.contentEl.innerText.trim()||'';
        this.data.text = text;
        this.contentEl.innerText = '';
        
        MarkdownRenderer.renderMarkdown(text,this.contentEl,this.mindmap.path||"",null).then(()=>{
            this.data.mdText = this.contentEl.innerHTML;
            this.refreshBox();
            this._delay();
        });

        if(text != this._oldText){
            this.mindmap.execute('changeNodeText',{
                node:this,
                text,
                oldText:this._oldText
            });
         }
       
        this.contentEl.setAttribute('contentEditable','false');
        this.isEdit = false;

    }

    getLevel() {
        var level = 0, parent = this.parent;

        if(this == this.mindmap.root){
            return level;
        }
        
        level++;
        
        while (parent && parent != this.mindmap.root) {
            level++;
            parent = parent.parent;
        }
        return level;
    }

    getChildren(){
        return this.children;
    }

    setPosition(x:number,y:number){
        this.box.x=x;
        this.box.y=y;
        this.containEl.style.left = x + 'px';
        this.containEl.style.top = y + 'px';
    }

    getPosition(){
        return {
            x:this.box.x,
            y:this.box.y
        }
    }

    move(dx:number, dy:number) {
        var p = this.getPosition();
        this.setPosition(p.x + dx, p.y + dy);
    }

    getData(){
        return JSON.parse(JSON.stringify(this.data))
    }

    refreshBox(){
        this.box = this.getDomBox();
    }

    getBox(){
        return {...{},...this.box};
    }

    getCBox(){
        return {...{},...this.box};
    }

    getDomBox(){
        var t = parseInt(this.containEl.style.top);
        var l = parseInt(this.containEl.style.left);
        var w = Math.ceil(this.contentEl.offsetWidth);
        var h = Math.ceil(this.contentEl.offsetHeight);

        return {
            x: l,
            y: t,
            width: w,
            height: h,
            th:0,
            bh:0
        }
    }

    getShowNodeList(){
        var list = [];
        (function getList(node:Node) {
            if (node.isShow()) {
                list.push(node);
            }
            node.children.forEach((n) => {
                getList(n);
            });
        })(this);

        return list;
    }

    getSiblings() {
        if (this.parent) {
            return this.parent.children.filter(item => item != this);
        } else {
            return [];
        }
    }

    isLeaf() {
        return !this.children.length
    }


    isShow() {
        return !this.isHide;
    }

    show(){
        this.containEl.style.display="block";
        this.isHide=false
    }

    hide(){
        this.containEl.style.display="none";
        this.isHide=true
    }

    clearCacheData(){
        var anchor:Node = this;
        while(anchor){
            anchor.boundingRect=null;
            anchor = anchor.parent;
        }
    }

    addChild(node:Node, i?:number) {
        if (this.children.indexOf(node) == -1) {
            if (i > -1) {
                if (i > this.children.length) i = this.children.length;
                this.children.splice(i, 0, node);
            } else {
                this.children.push(node);
            }
            node.parent = this;
        }
    }

    removeChild(child:Node) {
        var index = this.children.indexOf(child);
        if (index > -1) {
            this.children.splice(index, 1);
        }
        return index;
    }

    setText(text:string) {
        this.data.text = text;
        this.contentEl.innerHTML='';
        this.parseText();
    }

    expand(){
        this.isExpand =true;
        function show(node:Node) {
            node.show();
            node.boundingRect = null;
            if (node.isExpand) {
                node.children.forEach(c => {
                    show(c)
                });
            }
        };
        show(this);
        if(this.containEl.classList.contains('mm-node-collapse')){
            this.containEl.classList.remove('mm-node-collapse')
        }
    }

    collapse(){
        
        this.isExpand = false;
        function hide(node:Node) {
            node.hide();
            if (node.isExpand) {
                node.children.forEach(c => {
                    hide(c);
                });
            }
        };

        this.children.forEach((c:Node) => {
            hide(c);
        });

        if(!this.containEl.classList.contains('mm-node-collapse')){
            this.containEl.classList.add('mm-node-collapse')
        }
    }

   

}