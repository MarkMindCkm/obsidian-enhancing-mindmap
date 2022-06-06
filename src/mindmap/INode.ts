import MindMap from './mindmap' 
import {MarkdownRenderer,normalizePath,TFile,parseLinktext,resolveSubpath} from 'obsidian'
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
    expanded?:boolean;
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
    data:any
    constructor( data:INode,mindMap?:MindMap){
       this.data = data;
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
           //parse md
           this.contentEl.findAll(".internal-embed").forEach(async (el) => {
            const src = el.getAttribute("src");
            if(typeof src ==='string'){
                var pathObj=parseLinktext(src);
                var fileData ='';
               if(this.mindmap&&this.mindmap.view){
                    var f = this.mindmap.view.app.metadataCache.getFirstLinkpathDest(pathObj.path,this.mindmap.path);
                    if(f instanceof TFile&&f.extension ==='md'){
                         fileData = await this.mindmap.view.app.vault.adapter.read(f.path);
                         var markdownEmbed = document.createElement('div');
                         markdownEmbed.classList.add('markdown-embed');
                        //  var  markdownHead = document.createElement('div');
                        //  markdownHead.classList.add('markdown-embed-title');
                        //  markdownHead.innerText=f.basename;
                         markdownEmbed.setAttribute('data-name',f.path);
                         var markdownContent = document.createElement('div');
                         markdownContent.classList.add('markdown-embed-content');
                         var markdownPreview = document.createElement('div');
                         markdownPreview.classList.add('markdown-preview-view');
                         markdownContent.appendChild(markdownPreview);
                         var markdownLink = document.createElement('div');
                         markdownLink.classList.add('markdown-embed-link');
                         markdownLink.setAttribute('aria-label','Open link');
                         markdownLink.innerHTML = `<a data-href="${src}" href="${src}" class="internal-link" target="_blank" rel="noopener"><svg viewBox="0 0 100 100" class="link" width="20" height="20"><path fill="currentColor" stroke="currentColor" d="M74,8c-4.8,0-9.3,1.9-12.7,5.3l-10,10c-2.9,2.9-4.7,6.6-5.1,10.6C46,34.6,46,35.3,46,36c0,2.7,0.6,5.4,1.8,7.8l3.1-3.1 C50.3,39.2,50,37.6,50,36c0-3.7,1.5-7.3,4.1-9.9l10-10c2.6-2.6,6.2-4.1,9.9-4.1s7.3,1.5,9.9,4.1c2.6,2.6,4.1,6.2,4.1,9.9 s-1.5,7.3-4.1,9.9l-10,10C71.3,48.5,67.7,50,64,50c-1.6,0-3.2-0.3-4.7-0.8l-3.1,3.1c2.4,1.1,5,1.8,7.8,1.8c4.8,0,9.3-1.9,12.7-5.3 l10-10C90.1,35.3,92,30.8,92,26s-1.9-9.3-5.3-12.7C83.3,9.9,78.8,8,74,8L74,8z M62,36c-0.5,0-1,0.2-1.4,0.6l-24,24 c-0.5,0.5-0.7,1.2-0.6,1.9c0.2,0.7,0.7,1.2,1.4,1.4c0.7,0.2,1.4,0,1.9-0.6l24-24c0.6-0.6,0.8-1.5,0.4-2.2C63.5,36.4,62.8,36,62,36 z M36,46c-4.8,0-9.3,1.9-12.7,5.3l-10,10c-3.1,3.1-5,7.2-5.2,11.6c0,0.4,0,0.8,0,1.2c0,4.8,1.9,9.3,5.3,12.7 C16.7,90.1,21.2,92,26,92s9.3-1.9,12.7-5.3l10-10C52.1,73.3,54,68.8,54,64c0-2.7-0.6-5.4-1.8-7.8l-3.1,3.1 c0.5,1.5,0.8,3.1,0.8,4.7c0,3.7-1.5,7.3-4.1,9.9l-10,10C33.3,86.5,29.7,88,26,88s-7.3-1.5-9.9-4.1S12,77.7,12,74 c0-3.7,1.5-7.3,4.1-9.9l10-10c2.6-2.6,6.2-4.1,9.9-4.1c1.6,0,3.2,0.3,4.7,0.8l3.1-3.1C41.4,46.6,38.7,46,36,46L36,46z"></path></svg></a>`
                       
                         el.appendChild(markdownEmbed);
                        //  markdownEmbed.appendChild(markdownHead);
                         markdownEmbed.appendChild(markdownContent);
                         markdownEmbed.appendChild(markdownLink);

                        if(pathObj.subpath){
                            var metacache = this.mindmap.view.app.metadataCache.getFileCache(f);
                            var t=resolveSubpath(metacache,pathObj.subpath);
                         //   console.log(t);
                            if(t&&t.start&&t.end){
                              var md =fileData.substring(t.start.offset,t.end.offset);
                             // console.log(md)
                            }else if(t&&t.start&&!t.end){
                                var md = fileData.substr(t.start.offset);
                            }else{
                                var md = fileData||'';
                            }
                        }else{
                            var md=fileData||'';
                        }

                        if(md){
                            MarkdownRenderer.renderMarkdown(md,markdownPreview,this.mindmap.path||"",null).then(()=>{
                               // this.data.mdText = this.editDom.innerHTML;
                                this.refreshBox();
                                //this._delay();
                                this.mindmap&&this.mindmap.emit('renderEditNode',{node:this});
                            });
                        }

                    }
               }
            }
          });
         //parse image
         setTimeout(()=>{
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

         },100)
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
        //var _t =  this.data.text.replace(/\r\n/g,"<br/>")
       // _t = _t.replace(/\n/g,"<br/>");
      //  console.log(_t);
        this.contentEl.innerText = this.data.text;
        this.contentEl.setAttribute('contentEditable','true');
        this.contentEl.focus();
        this.mindmap.editNode = this;
        this.isEdit = true;
        keepLastIndex(this.contentEl);
     
        if (this.contentEl.innerText == t('Sub title')) {
            this.selectText();
        }

        if(!this.containEl.classList.contains('mm-edit-node')){
            this.containEl.classList.add('mm-edit-node')
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

        if(this.containEl.classList.contains('mm-edit-node')){
            this.containEl.classList.remove('mm-edit-node')
        }

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
            node.refreshBox();
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
