import INode, { INodeData } from './INode'
import Layout from './Layout'
import { Notice, Platform } from 'obsidian'
import SVG from 'svg.js'
import { MindMapView } from '../MindMapView'
import { frontMatterKey, basicFrontmatter } from '../constants';
import Exec from './Execute'
import {uuid} from '../MindMapView'

import importXmind  from './import/xmindZen'
import jsZip from 'jszip'

let deleteIcon = '<svg class="icon" width="16px" height="16.00px" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path  d="M799.2 874.4c0 34.4-28 62.4-62.368 62.4H287.2a62.496 62.496 0 0 1-62.4-62.4V212h574.4v662.4zM349.6 100c0-7.2 5.6-12.8 12.8-12.8h300c7.2 0 12.768 5.6 12.768 12.8v37.6H349.6V100z m636.8 37.6H749.6V100c0-48-39.2-87.2-87.2-87.2h-300a87.392 87.392 0 0 0-87.2 87.2v37.6H37.6C16.8 137.6 0 154.4 0 175.2s16.8 37.6 37.6 37.6h112v661.6A137.6 137.6 0 0 0 287.2 1012h449.6a137.6 137.6 0 0 0 137.6-137.6V212h112c20.8 0 37.6-16.8 37.6-37.6s-16.8-36.8-37.6-36.8zM512 824c20.8 0 37.6-16.8 37.6-37.6v-400c0-20.8-16.768-37.6-37.6-37.6-20.8 0-37.6 16.8-37.6 37.6v400c0 20.8 16.8 37.6 37.6 37.6m-175.2 0c20.8 0 37.6-16.8 37.6-37.6v-400c0-20.8-16.8-37.6-37.6-37.6s-37.6 16.8-37.6 37.6v400c0.8 20.8 17.6 37.6 37.6 37.6m350.4 0c20.8 0 37.632-16.8 37.632-37.6v-400c0-20.8-16.8-37.6-37.632-37.6-20.768 0-37.6 16.8-37.6 37.6v400c0 20.8 16.8 37.6 37.6 37.6" /></svg>';
let addIcon = '<svg class="icon" width="16px" height="16.00px" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path  d="M512 1024C230.4 1024 0 793.6 0 512S230.4 0 512 0s512 230.4 512 512-230.4 512-512 512z m0-960C265.6 64 64 265.6 64 512s201.6 448 448 448 448-201.6 448-448S758.4 64 512 64z"  /><path d="M800 544H224c-19.2 0-32-12.8-32-32s12.8-32 32-32h576c19.2 0 32 12.8 32 32s-12.8 32-32 32z"  /><path  d="M512 832c-19.2 0-32-12.8-32-32V224c0-19.2 12.8-32 32-32s32 12.8 32 32v576c0 19.2-12.8 32-32 32z"  /></svg>';

interface Setting {
    theme?: string;
    canvasSize?: number;
    background?: string;
    fontSize?: number;
    color?: string,
    exportMdModel?: string,
    headLevel: number,
    layoutDirect: string,
    strokeArray?:any[]
}

export default class MindMap {
    root: INode;
    status: string;
    appEl: HTMLElement;
    contentEL: HTMLElement;
    containerEL: HTMLElement;
    path?: string;
    editNode?: INode;
    selectNode?: INode;
    setting: Setting;
    data: INodeData;
    drag?: boolean;
    startX?: number;
    startY?: number;
    dx?: number;
    dy?: number;
    mmLayout?: Layout;
    draw: any;
    edgeGroup: any;
    _nodeNum: number = 0;
    _tempNum: number = 0;
    view?: MindMapView;
    colors: string[] = [];
    _dragNode: INode;
    exec: Exec;
    scalePointer: number[] = [];
    mindScale = 100;
    timeOut: any = null;
    _indicateDom:HTMLElement;
    _menuDom:HTMLElement;
    _dragType:string='';
    _left:number;
    _top:number;
    constructor(data: INodeData, containerEL: HTMLElement, setting?: Setting) {
        this.setting = Object.assign({
            theme: 'default',
            canvasSize: 8000,
            fontSize: 16,
            background: 'transparent',
            color: 'inherit',
            exportMdModel: 'default',
            headLevel: 2,
            layoutDirect: ''
        }, setting || {});


        this.data = data;
        this.appEl = document.createElement('div');

        this.appEl.classList.add('mm-mindmap');
        this.appEl.classList.add(`mm-theme-${this.setting.theme}`);
        this.appEl.style.overflow = "auto";


        this.contentEL = document.createElement('div');
        this.contentEL.style.position = "relative";
        this.contentEL.style.width = "100%";
        this.contentEL.style.height = "100%";
        this.appEl.appendChild(this.contentEL);
        this.draw = SVG(this.contentEL).size('100%', '100%');

        this.setAppSetting();
        containerEL.appendChild(this.appEl);
        this.containerEL = containerEL;


        //layout direct
        this._indicateDom = document.createElement('div');
        this._indicateDom.classList.add('mm-node-layout-indicate');
        this._indicateDom.style.display='none';

        //menu
        this._menuDom = document.createElement('div');
        this._menuDom.classList.add('mm-node-menu');
        this._menuDom.style.display='none';
        this.setMenuIcon();

        this.contentEL.appendChild(this._indicateDom);
        this.contentEL.appendChild(this._menuDom);

        //history
        this.exec = new Exec();

        // link line
        this.edgeGroup = this.draw.group();

        this.appClickFn = this.appClickFn.bind(this);
        this.appDragstart = this.appDragstart.bind(this);
        this.appDragend = this.appDragend.bind(this);
        this.appDragover = this.appDragover.bind(this);
        this.appDblclickFn = this.appDblclickFn.bind(this);
        this.appMouseOverFn = this.appMouseOverFn.bind(this);
        this.appDrop = this.appDrop.bind(this);
        this.appKeyup = this.appKeyup.bind(this);
        this.appKeydown = this.appKeydown.bind(this);
        this.appMousewheel = this.appMousewheel.bind(this);
        this.appMouseMove = this.appMouseMove.bind(this);

        this.appMouseDown = this.appMouseDown.bind(this);
        this.appMouseUp = this.appMouseUp.bind(this);

        //custom event
        this.initNode = this.initNode.bind(this);
        this.renderEditNode = this.renderEditNode.bind(this);
        this.mindMapChange = this.mindMapChange.bind(this);

        this.initEvent();
        //this.center();
    }

    setMenuIcon(){
        var addNodeDom = document.createElement('span');
        var deleteNodeDom = document.createElement('span');
        addNodeDom.classList.add('mm-icon-add-node'); 
        deleteNodeDom.classList.add('mm-icon-delete-node');
        addNodeDom.innerHTML = addIcon;
        deleteNodeDom.innerHTML = deleteIcon;
        this._menuDom.appendChild(addNodeDom);
        this._menuDom.appendChild(deleteNodeDom);
    }

    setAppSetting() {
        this.appEl.style.width = `${this.setting.canvasSize}px`;
        this.appEl.style.height = `${this.setting.canvasSize}px`;
        this.contentEL.style.width = `100%`;
        this.contentEL.style.height = `100%`;
        //  this.contentEL.style.color=`${this.setting.color};`;
        this.contentEL.style.background = `${this.setting.background}`;
        this.contentEL.style.fontSize = `${this.setting.fontSize}px`;
    }
    //create node
    init(collapsedIds?: string[]) {
        var that = this;
        var data = this.data;
        var x = this.setting.canvasSize / 2 - 60;
        var y = this.setting.canvasSize / 2 - 200;
        var waitCollapseNodes:INode[]=[];

        function initNode(d: INodeData, isRoot: boolean, p?: INode) {
            that._nodeNum++;
            var n = new INode(d, that);
            // if (collapsedIds && collapsedIds.includes(n.getId())) {
            //     n.isExpand = false;
            // }
            // if (p && (!p.isExpand || p.isHide)) {
            //     n.isHide = true;
            // }

            that.contentEL.appendChild(n.containEl);
            if (isRoot) {
                n.setPosition(x, y);
                that.root = n;
                n.isRoot = true;
            } else {
                n.setPosition(0, 0);
                p.children.push(n);
                n.parent = p;
            }

            n.refreshBox();

            if(!d.expanded){
                waitCollapseNodes.push(n)
            }
            n.refreshBox();
            if (d.children && d.children.length) {
                d.children.forEach((dd: INodeData) => {
                    initNode(dd, false, n);
                });
            }
        }
        initNode(data, true);

        if(waitCollapseNodes.length){
            waitCollapseNodes.forEach(n=>{
                n.collapse();
            });
        }
    }

    traverseBF(callback: Function, node?: INode) {
        var array = [];
        array.push(node || this.root);
        var currentNode = array.shift();
        while (currentNode) {
            for (let i = 0, len = currentNode.children.length; i < len; i++) {
                array.push(currentNode.children[i]);
            }
            callback(currentNode);
            currentNode = array.shift();
        }
    }

    traverseDF(callback: Function, node?: INode, cbFirst?: boolean) {
        function recurse(currentNode: INode) {
            if (currentNode) {
                if (cbFirst) {
                    callback(currentNode);
                }
                if (currentNode.children) {
                    for (var i = 0, length = currentNode.children.length; i < length; i++) {
                        recurse(currentNode.children[i]);
                    }
                }
                if (!cbFirst) {
                    callback(currentNode);
                }
            }
        }
        recurse(node || this.root);

    }

    getNodeById(id: string) {
        var snode: INode = null;
        this.traverseDF((n: INode) => {
            if (n.getId() == id) {
                snode = n;
            }
        });

        return snode;
    }

    clearSelectNode() {
        if (this.selectNode) {
            this.selectNode.unSelect();
            this.selectNode = null
        }
        if (this.editNode) {
            if(this.editNode.isEdit){
                this.editNode.cancelEdit();
            }
            this.editNode = null;
        }
    }


    initEvent() {
        this.appEl.addEventListener('click', this.appClickFn);
        this.appEl.addEventListener('mouseover', this.appMouseOverFn);
        this.appEl.addEventListener('dblclick', this.appDblclickFn);
        this.appEl.addEventListener('dragstart', this.appDragstart);
        this.appEl.addEventListener('dragover', this.appDragover);
        this.appEl.addEventListener('dragend', this.appDragend);
        this.appEl.addEventListener('drop', this.appDrop);
        document.addEventListener('keyup', this.appKeyup);
        document.addEventListener('keydown', this.appKeydown);
        document.body.addEventListener('mousewheel', this.appMousewheel);
        
        if(Platform.isDesktop){
            this.appEl.addEventListener('mousedown', this.appMouseDown);
            this.appEl.addEventListener('mouseup', this.appMouseUp);
        }

        this.appEl.addEventListener('mousemove', this.appMouseMove);
        //custom event
        this.on('initNode', this.initNode);
        this.on('renderEditNode', this.renderEditNode);
        this.on('mindMapChange', this.mindMapChange);

    }

    removeEvent() {
        this.appEl.removeEventListener('click', this.appClickFn);
        this.appEl.removeEventListener('dragstart', this.appDragstart);
        this.appEl.removeEventListener('dragover', this.appDragover);
        this.appEl.removeEventListener('dragend', this.appDragend);
        this.appEl.removeEventListener('dblClick', this.appDblclickFn);
        this.appEl.removeEventListener('mouseover', this.appMouseOverFn);
        this.appEl.removeEventListener('drop', this.appDrop);
        document.removeEventListener('keyup', this.appKeyup);
        document.removeEventListener('keydown', this.appKeydown);
        document.body.removeEventListener('mousewheel', this.appMousewheel);

        if(Platform.isDesktop){
            this.appEl.removeEventListener('mousedown', this.appMouseDown);
            this.appEl.removeEventListener('mouseup', this.appMouseUp);
        }
        
        this.appEl.removeEventListener('mousemove', this.appMouseMove);

        this.off('initNode', this.initNode);
        this.off('renderEditNode', this.renderEditNode);
        this.off('mindMapChange', this.mindMapChange);
    }

    initNode(evt: CustomEvent) {
        this._tempNum++;
        //console.log(this._nodeNum,this._tempNum);

        if (this._tempNum == this._nodeNum) {
            this.refresh();
            this.center();
        }
    }

    renderEditNode(evt: CustomEvent) {
        var node = evt.detail.node || null;
        node?.clearCacheData();
        this.refresh();
    }

    mindMapChange() {
        //console.log(this.view)
        this.view?.mindMapChange();
    }

    appKeydown(e: KeyboardEvent) {

        var keyCode = e.keyCode || e.which || e.charCode;
        var ctrlKey = e.ctrlKey || e.metaKey;
        var shiftKey = e.shiftKey;
        if (!ctrlKey && !shiftKey) {
            // tab
            if (keyCode == 9 || keyCode == 45) {
                e.preventDefault();
                e.stopPropagation();
            }

            if (keyCode == 32) {
                var node = this.selectNode;
                if (node && !node.isEdit) {
                    e.preventDefault();
                    e.stopPropagation();
                    node.edit();
                    this._menuDom.style.display = 'none';
                }
            }
        }


        if (ctrlKey && !shiftKey) {
            //ctrl + y
            if (keyCode == 89) {
                e.preventDefault();
                e.stopPropagation();
                this.redo();
            }

            //ctrl + z
            if (keyCode == 90) {
                e.preventDefault();
                e.stopPropagation();
                this.undo();
            }

        }
    }

    appKeyup(e: KeyboardEvent) {
        var keyCode = e.keyCode || e.which || e.charCode;
        var ctrlKey = e.ctrlKey || e.metaKey;
        var shiftKey = e.shiftKey;
        if (!ctrlKey && !shiftKey) {
            //enter 
            if (keyCode == 13 || e.key =='Enter') {
                var node = this.selectNode;
                if (node && !node.isEdit) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!node.isExpand) {
                        node.expand();
                    }
                    if (!node.parent) return;
                    node.mindmap.execute('addSiblingNode', {
                        parent: node.parent
                    });
                    this._menuDom.style.display='none';
                }
            }

            //delete
            if (keyCode == 46 || e.key == 'Delete' || e.key == 'Backspace') {
                var node = this.selectNode;
                if (node && !node.isEdit) {
                    e.preventDefault();
                    e.stopPropagation();
                    node.mindmap.execute("deleteNodeAndChild", { node });
                    this._menuDom.style.display='none';
                }
            }

            //tab
            if (keyCode == 9 || keyCode == 45 || e.key == 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                var node = this.selectNode;
                if (node && !node.isEdit) {
                    if (!node.isExpand) {
                        node.expand();
                    }
                    node.mindmap.execute("addChildNode", { parent: node });
                    this._menuDom.style.display='none';
                } else if (node && node.isEdit) {
                    node.cancelEdit();
                    node.select();
                    node.mindmap.editNode=null;
                }
            }

            // up
            if (keyCode == 38 || e.key == 'ArrowUp') {
                var node = this.selectNode;
                if (node && !node.isEdit) {
                    this._selectNode(node, "up");
                }
            }

            if (keyCode == 40 || e.key == 'ArrowDown') {
                var node = this.selectNode;
                if (node && !node.isEdit) {
                    this._selectNode(node, "down");
                }
            }

            if (keyCode == 39 || e.key == 'ArrowRight') {
                var node = this.selectNode;
                if (node && !node.isEdit) {
                    this._selectNode(node, "right");
                }
            }

            if (keyCode == 37 || e.key == 'ArrowLeft') {
                var node = this.selectNode;
                if (node && !node.isEdit) {
                    this._selectNode(node, "left");
                }
            }

        }


        if (ctrlKey && !shiftKey) {
            //ctr + /  toggle expand node
            if (keyCode == 191) {
                var node = this.selectNode;
                if (node && !node.isEdit) {
                    if (node.isExpand) {
                        node.mindmap.execute('collapseNode', {
                            node
                        })
                    } else {
                        node.mindmap.execute('expandNode', {
                            node
                        })
                    }
                }
            }

            // ctrl + E  center
            if (keyCode == 69) {
                this.center();
            }
        }
    }

    _selectNode(node: INode, direct: string) {
        if (!node) {
            return;
        }

        var minDis: number;
        var waitNode: INode = null;
        var pos = node.getPosition();
        var mind = this;


        mind.traverseDF((n: INode) => {
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

        if (waitNode) {
            mind.clearSelectNode();
            waitNode.select();
        }
    }

    appClickFn(evt: MouseEvent) {
        var targetEl = evt.target as HTMLElement;

        if (targetEl) {
             
            if (targetEl.tagName == 'A' && targetEl.hasClass("internal-link")) {
                evt.preventDefault();
                var targetEl = evt.target as HTMLElement;
                var href = targetEl.getAttr("href");
                if(href){
                    this.view.app.workspace.openLinkText(
                        href,
                        this.view.file.path,
                        evt.ctrlKey || evt.metaKey
                    );
                }
            }

            if (targetEl.hasClass('mm-node-bar')) {
                evt.preventDefault();
                evt.stopPropagation();
                var id = targetEl.closest('.mm-node').getAttribute('data-id');
                var node = this.getNodeById(id);

                if (node.isExpand) {
                    node.mindmap.execute('collapseNode', {
                        node
                    });
                } else {
                    node.mindmap.execute('expandNode', {
                        node
                    });
                }
                return
            }

            if(targetEl.closest('.mm-node-menu')){
                 if(targetEl.closest('.mm-icon-add-node')){
                      var selectNode = this.selectNode;
                      if(selectNode){
                         selectNode.mindmap.execute("addChildNode", { parent: selectNode });
                         this._menuDom.style.display='none';
                      }
                 }

                 if(targetEl.closest('.mm-icon-delete-node')){
                    var selectNode = this.selectNode;
                    if(selectNode){
                       selectNode.mindmap.execute("deleteNodeAndChild", { node: selectNode });
                       this._menuDom.style.display='none';
                    }
                 }
                 return;
            }

            if (targetEl.closest('.mm-node')) {
                var id = targetEl.closest('.mm-node').getAttribute('data-id');
                var node = this.getNodeById(id);
                if (!node.isSelect) {
                    this.clearSelectNode();
                    this.selectNode = node;
                    this.selectNode?.select();
                    this._menuDom.style.display='block';
                    var box = this.selectNode.getBox();
                    this._menuDom.style.left = `${box.x + box.width + 10}px`;
                    this._menuDom.style.top = `${box.y + box.height/2 - 14}px`;
                }
            } else {
                this.clearSelectNode();
                this._menuDom.style.display='none';
            }
        }
    }

    appDragstart(evt: MouseEvent) {
        evt.stopPropagation();
        this.startX = evt.pageX;
        this.startY = evt.pageY;
        if (evt.target instanceof HTMLElement) {
            if (evt.target.closest('.mm-node')) {
                var id = evt.target.closest('.mm-node').getAttribute('data-id');
                this._dragNode = this.getNodeById(id);
                this.drag = true;
            }
        }
    }

    appDragend(evt: MouseEvent) {
        this.drag = false;
        this._indicateDom.style.display = 'none'
        this._menuDom.style.display = 'none';
    }

    appDragover(evt: MouseEvent) {
        evt.preventDefault();
        evt.stopPropagation();
        var target =evt.target as HTMLElement;
        var x = evt.pageX;
        var y = evt.pageY;

        if (this.drag) {
            this.dx = x - this.startX;
            this.dx = y - this.startY;
        }

        if(target.closest('.mm-node')){
            var nodeId =target.closest('.mm-node').getAttribute('data-id');
            var node = this.getNodeById(nodeId);
            var box = node.getBox();
            this._dragType = this._getDragType(node, x, y);
            this._indicateDom.style.display = 'block';
            this._indicateDom.style.left = box.x + box.width / 2 - 40 / 2 + 'px';
            this._indicateDom.style.top = box.y - 90 + 'px';
            this._indicateDom.className = 'mm-node-layout-indicate';

            if( this._dragType == 'top') {
                this._indicateDom.classList.add('mm-arrow-top');
            } else if ( this._dragType == 'down') {
                this._indicateDom.classList.add('mm-arrow-down');
            } else if ( this._dragType == 'left') {
                this._indicateDom.classList.add('mm-arrow-left');
            } else if ( this._dragType == 'right') {
                this._indicateDom.classList.add('mm-arrow-right');
            } else {
                this._indicateDom.classList.add('drag-type');
                var arr = this._dragType.split('-');
                if (arr[1]) {
                    this._indicateDom.classList.add('mm-arrow-' + arr[1]);
                } else {
                    this._indicateDom.classList.add('mm-arrow-right');
                }
            }
        }else{
            this._indicateDom.style.display = 'none';
        }
        
    }

    _getDragType(node:INode, x:number, y:number) {
        if (!node) return;
    
        var box = node.contentEl.getBoundingClientRect();

        box.x = box.x
        box.y = box.y;

        var direct = node.direct;
        switch (direct) {
            case 'right':
                if (y < box.y + box.height / 2 && x < box.x + box.width / 4 * 3) {
                    return 'top'
                }
                if (y > box.y + box.height / 2 && x < box.x + box.width / 4 * 3) {
                    return 'down'
                }
                return 'child-right'
            case 'left':
                if (y < box.y + box.height / 2 && x > box.x + box.width / 4) {
                    return 'top'
                }
                if (y > box.y + box.height / 2 && x > box.x + box.width / 4) {
                    return 'down'
                }

                return 'child-left'

            case 'top':
            case 'up':

                if (x < box.x + box.width / 4) {
                    return 'left'
                }
                if (x > box.x + box.width / 4 * 3) {
                    return 'right'
                }

                return 'child-top'
            case 'down':
            case 'bottom':
                if (x < box.x + box.width / 4) {
                    return 'left'
                }
                if (x > box.x + box.width / 4 * 3) {
                    return 'right'
                }
                return 'child-down'
            default:
                return 'child';

        }
    }

    appDrop(evt: any) {
        if (evt.target instanceof HTMLElement) {
            if (evt.target.closest('.mm-node')) {
                evt.preventDefault();
                var dropNodeId = evt.target.closest('.mm-node').getAttribute('data-id');
                var dropNode = this.getNodeById(dropNodeId);
                if (this._dragNode.isRoot) {

                } else {
                    this.moveNode(this._dragNode, dropNode,this._dragType);
                }
            }
        }

        var files = evt.dataTransfer.files;
            if(files.length){
                  var f = files[0];
                  if(f.name.toLowerCase().endsWith('.xmind')){
                   try{
                       var me = this;
                       var reader = new FileReader();
                       reader.onload=()=>{
                            jsZip.loadAsync(reader.result).then((e)=>{
                               var files = e.files;
                               for (var k in files) {
                                  if (k == "content.json") {
                                   files[k].async("text").then((res) => {
                                     var mindData = JSON.parse(res);
                                       var data:any = importXmind(mindData[0]);

                                

                                       me.clearNode();
                                       me.data = data.basicData;
                                       me.init();
                                       setTimeout(()=>{
                                           me.center(); 
                                           me.mindMapChange();
                                       },100);
                                   });
                                 }
                               }
                            })
                       }
                       reader.readAsArrayBuffer(f);
                   }catch(err){
                      new Notice('Parse xmind error')
                   }
                  }

            
       }

        this._indicateDom.style.display = 'none'
        this._menuDom.style.display = 'none';
    }

    appMouseOverFn(evt: MouseEvent) {
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

    appMouseMove(evt: MouseEvent) {
        const targetEl = evt.target as HTMLElement;
        this.scalePointer = [];
        this.scalePointer.push(evt.offsetX, evt.offsetY);
        if (targetEl.closest('.mm-node')) {
            var id = targetEl.closest('.mm-node').getAttribute('data-id');
            var node = this.getNodeById(id);
            if (node) {
                var box = node.getBox();
                this.scalePointer = [];
                this.scalePointer.push(box.x + box.width / 2, box.y + box.height / 2);
            }
        }else{
            if(this.drag){
                this.containerEL.scrollLeft = this._left - (evt.pageX - this.startX); 
                this.containerEL.scrollTop = this._top - (evt.pageY - this.startY); 
            }
        }
    }

    appMouseDown(evt:MouseEvent){
        const targetEl = evt.target as HTMLElement;
        if(!targetEl.closest('.mm-node')){
            this.drag = true;
            this.startX = evt.pageX;
            this.startY = evt.pageY;
            this._left = this.containerEL.scrollLeft;
            this._top = this.containerEL.scrollTop;
        }
    }

    appMouseUp(evt:MouseEvent){
        this.drag = false;
    }

    appDblclickFn(evt: MouseEvent) {
        if (evt.target instanceof HTMLElement) {

            if (evt.target.hasClass('mm-node-bar')) {
                evt.preventDefault();
                evt.stopPropagation();
                return;
            }
            if (evt.target.closest('.mm-node') instanceof HTMLElement) {
                var id = evt.target.closest('.mm-node').getAttribute('data-id');
                this.selectNode = this.getNodeById(id);
                if (!this.editNode || (this.editNode && this.editNode != this.selectNode)) {
                    this.selectNode?.edit();
                    this.editNode = this.selectNode;
                    this._menuDom.style.display='none';
                }
            }
        }
    }

    appMousewheel(evt: any) {
        // if(!evt) evt = window.event;
        var ctrlKey = evt.ctrlKey || evt.metaKey;
        var delta;
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

    clearNode() {
        //delete node
        this.traverseBF((n: INode) => {
            this.contentEL.removeChild(n.containEl);
        });

        //delete line
        if (this.mmLayout) {
            this.mmLayout.svgDom?.clear();
        }

    }

    clear() {
        this.clearNode();
        this.removeEvent();
        this.draw?.clear();
    }
    //get node list rect point
    getBoundingRect(list: INode[]) {
        var box = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            right: 0,
            bottom: 0
        };
        list.forEach((item, i) => {
            var b = item.getBox();
           // console.log(b.x,b.y);
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

    moveNode(dragNode: INode, dropNode: INode,type:string) {

        if (dragNode == dropNode || dragNode.isRoot) {
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

        if (type == 'top' || type == 'left' ||type == 'down' || type == 'right') {   
           this.execute('moveNode', { type: 'siblings', node: dragNode, oldParent: dragNode.parent, dropNode, direct: type })
        }
        else if (type.indexOf('child') > -1) {
            var typeArr = type.split('-');
            if (typeArr[1]) {
                this.execute('moveNode', { type: 'child', node: dragNode, oldParent: dragNode.parent, parent: dropNode, direct: typeArr[1] })
            }
            else {
                this.execute('moveNode', { type: 'child', node: dragNode, oldParent: dragNode.parent, parent: dropNode });
            }
        }

       // this.execute('moveNode', { type: 'child', node: dragNode, oldParent: dragNode.parent, parent: dropNode })
    }

    //execute cmd , store history
    execute(name: string, data?: any) {
        this.exec.execute(name, data);
    }
    undo() {
        this.exec.undo();
    }

    redo() {
        this.exec.redo();
    }

    addNode(node: INode, parent?: INode, index = -1) {
        if (parent) {
            parent.addChild(node, index);
            if (parent.direct) {
                node.direct = parent.direct;
            }
            this._addNodeDom(node);
            node.clearCacheData();
        }
    }

    _addNodeDom(node: INode) {
        this.traverseBF((n: INode) => {
            if (!this.contentEL.contains(n.containEl)) {
                this.contentEL.appendChild(n.containEl);
            }
        }, node);
    }

    removeNode(node: INode) {
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

    _removeChildDom(node: INode) {
        this.traverseBF((n: INode) => {
            if (this.contentEL.contains(n.containEl)) {
                this.contentEL.removeChild(n.containEl);
            }
        }, node);
    }

    //layout
    layout() {
        if (!this.mmLayout) {
            this.mmLayout = new Layout(this.root, this.setting.layoutDirect||'mind map', this.colors);
            return;
        }

        this.mmLayout.layout(this.root, this.setting.layoutDirect || this.mmLayout.direct || 'mind map');
    }

    refresh() {
        this.layout();
    }

    emit(name: string, data?: any) {
        var evt = new CustomEvent(name, {
            detail: data || {}
        });
        this.appEl.dispatchEvent(evt);
    }

    on(name: string, fn: any) {
        this.appEl.addEventListener(name, fn);
    }

    off(name: string, fn: any) {
        if (name && fn) {
            this.appEl.removeEventListener(name, fn);
        }
    }

    center() {
        this._setMindScalePointer();
        var oldScale = this.mindScale;
        this.scale(100);

        var w = this.containerEL.clientWidth;
        var h = this.containerEL.clientHeight;
        this.containerEL.scrollTop = this.setting.canvasSize / 2 - h / 2 - 60;
        this.containerEL.scrollLeft = this.setting.canvasSize / 2 - w / 2 + 30;

        this.scale(oldScale);
    }

    _setMindScalePointer() {
        this.scalePointer = [];
        var root = this.root;
        if (root) {
            var rbox = root.getBox();
            this.scalePointer.push(rbox.x + rbox.width / 2, rbox.y + rbox.height / 2);
        }
    }

    getMarkdown() {
        var md = '';
        var level = this.setting.headLevel;
        this.traverseDF((n: INode) => {
            var l = n.getLevel() + 1;
            var hPrefix = '', space = '';
            if (l > 1) {
                hPrefix = '\n';
            }
            const ending = n.isExpand ? '' : ` ^${n.getId()}`
            if (n.getLevel() < level) {
                for (let i = 0; i < l; i++) {
                    hPrefix += '#';
                }
                md += (hPrefix + ' ');
                md += n.getData().text.trim() + ending + '\n';

            } else {
                for (var i = 0; i < n.getLevel() - level; i++) {
                    space += '   ';
                }
                var text = n.getData().text.trim();
                if (text) {
                    var textArr = text.split('\n');
                    var lineLength = textArr.length;

                    if (lineLength == 1) {
                        md += `${space}- ${text}${ending}\n`;
                    } else if (lineLength > 1) {
                        //code
                        if (text.startsWith('```')) {
                            md+='\n'
                            md += `${space}-\n`;
                            textArr.forEach((t: string, i: number) => {
                                md += `${space}  ${t.trim()}${i === textArr.length - 1 ? ending : '' }\n`
                            });
                            md+='\n'
                        } else {
                            //text
                            md += `${space}- `;
                            textArr.forEach((t: string, i: number) => {
                                if (i > 0) {
                                    md += `${space}   ${t.trim()}${i === textArr.length - 1 ? ending : '' }\n`
                                } else {
                                    md += `${t.trim()}\n`
                                }
                            });
                        }

                    }
                } else {
                    for (var i = 0; i < n.getLevel() - level; i++) {
                        space += '   ';
                    }
                    md += `${space}-\n`;
                }
            }
        }, this.root, true);
        return md.trim();
    }
    scale(num: number) {
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

    setScale(type: string) {
        if (type == "up") {
            var n = this.mindScale + 10;
        } else {
            var n = this.mindScale - 10;
        }
        this.scale(n);

        if (this.timeOut) {
            clearTimeout(this.timeOut)
        }

        this.timeOut = setTimeout(() => {
            new Notice(`${n} %`);
        }, 600);
    }

    copyNode(node?:any){
        var n = node||this.selectNode;
        if(n){
           var data:any = [];
           function copyNode(n:INode, pid:any) {
                  var d = n.getData();
                  d.id = uuid();
                  d.pid = pid;
                  data.push({
                      id:d.id,
                      text:d.text,
                      pid:pid,
                      isExpand:d.isExpand,
                      note:d.note
                  });
                  n.children.forEach((c) => {
                     copyNode(c, d.id);
                  });
          }

           copyNode(n,null)
        
           var _data = {
               type:'copyNode',
               text:data
           };

           return JSON.stringify(_data);

        }else{
            return ''
        }
  }

  pasteNode(text:string){
        var node = this.selectNode;
        if(text){
            try{
                  var json =JSON.parse(text);
                  if(json.type&&json.type=='copyNode'){
                    var data = json.text;
                    if(!node.isExpand){
                       node.expand();
                       node.clearCacheData();
                    }
                   this.execute('pasteNode',{
                       node:node,
                       data:data
                   })

                   navigator.clipboard.writeText('');
                  }
            }catch(err){
                console.log(err)
            }
        }

  }

}
