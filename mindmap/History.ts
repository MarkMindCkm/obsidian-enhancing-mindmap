import { Command } from "./Cmds";
class History {
    
    limit:number = 50;
    undos:Command[] = [];
    redos:Command[] = [];
    saveCommand:Command = null;

    constructor(limit?:number) {
        this.limit = limit || 50;     
    }

    execute(command:Command) {
        this.clearRedo();
        command.execute();
        var length = this.undos.length;
        if (length >= this.limit) {
            this.undos.shift();
        }
        this.undos.push(command);
        this.change(command)
    }

    undo() {
        if(this.canUndo()) {
            var command = this.undos.pop();
            this.redos.push(command);
            command.undo();
            this.change(command);
        }
    }

    canUndo() {
        return !!this.undos.length
    }

    redo() {
        if (this.canRedo()) {
            var command = this.redos.pop()
            this.undos.push(command);
            command.redo();
            this.change(command)
        }
    }

    canRedo() {
        return !!this.redos.length
    }

    save() {
        this.saveCommand = this.undos[this.undos.length - 1];
    }

    dirty() {
        return this.saveCommand != this.undos[this.undos.length - 1];
    }

    clearRedo() {
        this.redos = [];
    }

    clear() {
        this.undos = [];
        this.redos = [];
        this.saveCommand = null;
        this.change();
    }

    change(cmd?:any) {

    }
}
export default History;