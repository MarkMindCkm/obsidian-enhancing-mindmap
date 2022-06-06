import History from './History'
import * as cmd from './Cmds'
import { uuid } from '../MindMapView'
import {t} from '../lang/helpers'
import INode from './INode'

interface DataProps {
    node?:INode
    parent?:INode,
    oldParent?:INode,

    //change node text
    text?:string,
    oldText?:string,

    //change root position
    oldPos?:{
        x:number,
        y:number
    },
    newPos?:{
        x:number,
        y:number
    },
    data?:any
};

export default class Exec{
    history:History = new History(50);
    execute(name:string,data?:DataProps){
       switch(name){
            case 'addChildNode':
            case 'addSiblingNode':
                if(data){
                    var d = {
                        id: uuid(),
                        text: data.text || t('Sub title')
                    }
                    var parent:INode = data.parent;
                    var node = new INode(d,parent.mindmap);
                    this.history.execute(new cmd.AddNode(node, data.parent, parent.mindmap));
                }
                break;
            case 'deleteNodeAndChild':
                if(data){
                    var node =data.node;
                    this.history.execute(new cmd.RemoveNode(node, node.mindmap));
                }
                break;
            case 'deleteNodeExcludeChild':
                break;
            case 'changeNodeText':
                if(data){
                    this.history.execute(new cmd.ChangeNodeText(data.node, data.oldText,data.text));
                }
                break;
            case 'moveNode':
                if(data){
                    this.history.execute(new cmd.MoveNode(data));
                }
                break;
            case 'movePosition':
                if(data){
                    this.history.execute(new cmd.MovePos(data.node,data.oldPos,data.newPos));
                }
               break
            case 'expandNode':
                if(data){
                    this.history.execute(new cmd.ExpandNode(data.node));
                }
                break;
            case 'collapseNode':
                if(data){
                    this.history.execute(new cmd.CollapseNode(data.node));
                }
            break
            case 'pasteNode':
                this.history.execute(new cmd.PasteNode(data.node,data.data));
                break;
       }
    }


    undo(){
        this.history.undo()
    }

    redo(){
        this.history.redo()
    }
}