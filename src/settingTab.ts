import {
    App,
    PluginSettingTab,
    Setting,
} from 'obsidian';
import MindMap from './main';
import { t } from './lang/helpers'
import { MindMapView, mindmapViewType } from './MindMapView';
import MyNode from './mindmap/INode';

export class MindMapSettingsTab extends PluginSettingTab {
    plugin: MindMap;
    constructor(app: App, plugin: MindMap) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName(`${t('Canvas size')}`)
            .setDesc(`${t('Canvas size desc')}`)
            .addDropdown(dropDown =>
                dropDown
                    .addOption('4000', '4000')
                    .addOption('6000', '6000')
                    .addOption('8000', '8000')
                    .addOption('10000', '10000')
                    .addOption('12000', '12000')
                    .addOption('16000', '16000')
                    .addOption('20000', '20000')
                    .addOption('30000', '30000')
                    .addOption('36000', '36000')
                    .setValue(this.plugin.settings.canvasSize.toString() || '8000')
                    .onChange((value: string) => {
                        var _v = Number.parseInt(value)
                        this.plugin.settings.canvasSize = _v;
                        this.plugin.saveData(this.plugin.settings);
                        const mindmapLeaves = this.app.workspace.getLeavesOfType(mindmapViewType);
                        mindmapLeaves.forEach((leaf) => {
                            var v = leaf.view as MindMapView;
                            v.mindmap.setting.canvasSize = _v;
                            v.mindmap.setAppSetting();
                            var box = v.mindmap.root.getBox();
                            v.mindmap.root.setPosition(_v / 2 - box.width / 2, _v / 2 - box.height / 2);
                            v.mindmap.refresh();
                            v.mindmap.center();
                        });
                    }));

        new Setting(containerEl)
            .setName(`${t('Canvas background')}`)
            .setDesc(`${t('Canvas background desc')}`)
            .addText(text =>
                text
                    .setValue(this.plugin.settings.background || 'transparent')
                    .setPlaceholder('Example: black|white|#ccc')
                    .onChange((value: string) => {
                        this.plugin.settings.background = value;
                        this.plugin.saveData(this.plugin.settings);
                        const mindmapLeaves = this.app.workspace.getLeavesOfType(mindmapViewType);
                        mindmapLeaves.forEach((leaf) => {
                            var v = leaf.view as MindMapView;
                            v.mindmap.setting.background = this.plugin.settings.background;
                            v.mindmap.setAppSetting();
                        });
                    }));

        new Setting(containerEl)
            .setName(`${t('Max level of node to markdown head')}`)
            .setDesc(`${t('Max level of node to markdown head desc')}`)
            .addDropdown(dropDown =>
                dropDown
                    .addOption('0', '0')
                    .addOption('1', '1')
                    .addOption('2', '2')
                    .addOption('3', '3')
                    .addOption('4', '4')
                    .addOption('5', '5')
                    .addOption('6', '6')
                    .setValue(this.plugin.settings.headLevel.toString() || '2')
                    .onChange((value: string) => {
                        this.plugin.settings.headLevel = Number.parseInt(value);
                        this.plugin.saveData(this.plugin.settings);
                        const mindmapLeaves = this.app.workspace.getLeavesOfType(mindmapViewType);
                        mindmapLeaves.forEach((leaf) => {
                            var v = leaf.view as MindMapView;
                            v.mindmap.setting.headLevel = this.plugin.settings.headLevel;
                        });
                    }));



        new Setting(containerEl)
            .setName(`${t('Font size')}`)
            .setDesc(`${t('Font size desc')}`)
            .addText(text =>
                text
                    .setValue(this.plugin.settings.fontSize?.toString() || '16')
                    .setPlaceholder('Example: 16')
                    .onChange((value: string) => {
                        this.plugin.settings.fontSize = Number.parseInt(value);
                        this.plugin.saveData(this.plugin.settings);
                        const mindmapLeaves = this.app.workspace.getLeavesOfType(mindmapViewType);
                        mindmapLeaves.forEach((leaf) => {
                            var v = leaf.view as MindMapView;
                            v.mindmap.setting.fontSize = this.plugin.settings.fontSize;
                            v.mindmap.setAppSetting();
                            v.mindmap.traverseBF((n: MyNode) => {
                                n.boundingRect = null;
                                n.refreshBox();
                            })
                            v.mindmap.refresh();
                        });
                    }));

        new Setting(containerEl)
            .setName(`${t('Mind map layout direct')}`)
            .setDesc(`${t('Mind map layout direct desc')}`)
            .addDropdown(dropDown =>
                dropDown
                    .addOption('mind map', t('Centered'))
                    .addOption('right', t('Right'))
                    .addOption('left', t('Left'))
                    .addOption('clockwise', t('Clockwise'))
                    .setValue(this.plugin.settings.layoutDirect.toString() || 'mind map')
                    .onChange((value: string) => {
                        this.plugin.settings.layoutDirect = value;
                        this.plugin.saveData(this.plugin.settings);
                        const mindmapLeaves = this.app.workspace.getLeavesOfType(mindmapViewType);
                        mindmapLeaves.forEach((leaf) => {
                            var v = leaf.view as MindMapView;
                            v.mindmap.setting.layoutDirect = this.plugin.settings.layoutDirect;
                            v.mindmap.refresh();
                        });
                    }));

             new Setting(containerEl)
                    .setName(`${t('Stroke Array')}`)
                    .setDesc(`${t('Stroke Array Desc')}`)
                    .addText(text =>
                        text
                            .setValue(this.plugin.settings.strokeArray?.toString() || '')
                            .setPlaceholder('Example: red,orange,blue ...')
                            .onChange((value: string) => {
                                this.plugin.settings.strokeArray = value
                                this.plugin.saveData(this.plugin.settings);
                                const mindmapLeaves = this.app.workspace.getLeavesOfType(mindmapViewType);
                                
                                mindmapLeaves.forEach((leaf) => {
                                    var v = leaf.view as MindMapView;
                                    v.mindmap.setting.strokeArray = this.plugin.settings.strokeArray.split(',');
                                    if( v.mindmap.mmLayout){
                                        v.mindmap.mmLayout.colors=v.mindmap.setting.strokeArray;
                                    }
                                
                                    v.mindmap.traverseBF((n: MyNode) => {
                                        n.boundingRect = null;
                                        n.refreshBox();
                                    })
                                    v.mindmap.refresh();
                                });
                            }));
    }
}
