import {uuid} from '../../MindMapView'

var mind:{[ket:string]:any}={};

var color=['#fda16c','#74bdf7','#71FF5E','orange','#D4D4AA','yellow'];

var canvasWidth = 8000;
var canvasHeight = 8000;

const importXmind=function(data:any){
    mind={
        "theme":'blue',
        "mindData":[],
        "induceData":[],
        "wireFrameData":[],
        "relateLink":[],
       
        "background":'',
        "relateLinkData":[],
        "calloutData":[],
        'marks':[],
    };
      
         var mainlist:any[]=[];
         transferData(data.rootTopic,null,mainlist,true);
         var root=mainlist[0];
         
         data.rootTopic.children&&data.rootTopic.children.detached&&data.rootTopic.children.detached.forEach(d=>{
            var list:any[]=[]
            transferData(d,root.id,list);
            mainlist=mainlist.concat(list);
        });

        mind.mindData.push(mainlist);
        mind.basicData = transferListToData(mainlist);
   

   data.relationships&&data.relationships.forEach(rl=>{
       var obj={
        startNodeId: rl.end1Id,
        endNodeId: rl.end2Id,
        nodeData:{
            'text':'',
            'nodeType':'relateLink',
            'backgroundColor':'#f06'
        }
       }
       if(rl.title){
           obj.nodeData.text=rl.title;
       }
       mind.relateLinkData.push(obj);
   })

   
    return mind;
};




var task:{[key:string]:any}={
    'task-start':'0',
    'task-oct':'10',
    'task-3oct':'30',
    'task-5oct':'50',
    'task-7oct':'70',
    'task-9oct':'90',
    'task-done':'100',
}

function transferListToData(list:any):any{
    var obj:{[key:string]:any}={};

    var root = null;
   

    function transfer(data:any,i:number){
        var nodeData:{[key:string]:any} = {
            id:data.id,
            text:data.text,
            children:[],
            expanded:true
        }
        if(i==0){
            nodeData.main = true;
            nodeData.isRoot = true;
            root = nodeData;
        }

        return nodeData;
    }

    list.forEach((n:any,i:number)=>{
        var data = transfer(n,i);
        if(!obj[n.id]){
            obj[n.id]=data;
        }

        if(obj[n.pid]){
            obj[n.pid].children.push(data);
        }
    });

    return root;
}

function transferData(data:any,parentId:any,list?:any,mainFlag?:any){
    var text='';
     if(data.title){
          text=data.title;
     }
    
    var node:{[key:string]:any}={
        id:data.id,
        pid:parentId,
        text:text,
      //  percent:data.data.progress<=8?data.data.progress*10:'',
       // priority:data.data.priority,
        //link:data.href,
        note:'',
        //tag:data.data.resource
        marks:[],
       // resource:data.data.resource,
        expanded:true,
        image:'',
        imageName:'',
        x:0,
        y:0
    };


    if(!parentId){
        node.layout={};
        node.layout.layoutName="mindmap";
        node.layout.direct="right";
        if(mainFlag){
            node.isRoot=true;
            node.main=true;
            node.x=canvasWidth/2;
            node.y=canvasHeight/2;
        }
    }

    if(data.href){
        node.link=data.href;
    }
    if(data.notes){
        node.note=data.notes.plain.content.trim();
    }
    // if(data.image){
    //     node.isImageNode=true;
       
    //     node.image='';
    //     node.imageName=data.image.src.replace('xap:resources/','');
    // }

    if(data.labels){
        node.marks=[];
        data.labels.forEach((lab:any)=>{
            node.marks.push({
                id:uuid(),
                text:lab,
                fill:color[parseInt(Math.random()*color.length+'')]
            });
        })
    }

    if(data.markers){
        data.markers.forEach((item:any)=>{
            if(item.markerId.indexOf('priority')>-1){
               node.priority=item.markerId.split('-')[1];
            }
            if(item.markerId.indexOf('task')>-1){
                node.percent=task[item.markerId]
            }
        })
    }

    list.push(node);

    data.children&&data.children.attached&&data.children.attached.forEach(c=>{
        transferData(c,data.id,list);
    });

    //induce
    data.summaries&&data.summaries.forEach((sum:any)=>{
          var r=sum.range.substring(1,sum.range.length-1);
         // console.log(r,'induce');
         var s=r.split(',')[0];
         var e=r.split(',')[1];
         
          var induceData:{[key:string]:any}={
            induceData:{
                nodeId:sum.topicId,
                range:r,
                id:sum.id,
            }
          }
          data.children.attached.forEach((c:any,i:number)=>{
             if(i==s){
                induceData.induceData.nodeId=c.id
             }
             if(i==e){
                induceData.induceData.endNodeId=c.id
             }
          });


          var mData:any[]=[];
          var summary=data.children.summary;
          var sumData=summary.filter((item:any)=>{
              return item.id==sum.topicId
          })[0];

          transferData(sumData,null,mData);
          mData[0].nodeType='induce';
          induceData.mindData=mData;
          mind.induceData.push(induceData);
    });

    //wireframe
    data.boundaries&&data.boundaries.forEach(bum=>{
        var r=bum.range.substring(1,bum.range.length-1);
        var s=r.split(',')[0];
        var e=r.split(',')[1];

        var wf:{[key:string]:any}={
            stroke: "rgb(206, 214, 218)",
            fill: "transparent",
            lineDash:  [6, 2],
            radius:10,
            data:{
                text:'',
                nodeType:'wireFrame'
            }
        };
        if(bum.title){
            wf.data={
                text:bum.title,
                nodeType:'wireFrame'
            }
        }

        data.children.attached.forEach((c:any,i:number)=>{
            if(i==s){
                wf.nodeId=c.id
            }
            if(i==e){
                wf.endNodeId=c.id
            }
        });
        wf.range=r;
        mind.wireFrameData.push(wf);
    });

    //collout
    data.children&&data.children.callout&&data.children.callout.forEach(c=>{
       var callout={
           nodeId:data.id,
           color:'#f06',
           rootData:{
               text:c.title,
               id:c.id
           }
       }
       mind.calloutData.push(callout);
    });
   
  

}


export default importXmind;