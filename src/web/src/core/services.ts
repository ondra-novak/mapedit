export interface MapEditorControl {
    open_map: (s:string) => void;
}

export class MapEditorControlService {
    #inst: Promise<MapEditorControl>;
    #resolve!: (x:MapEditorControl)=>void;
    constructor() {
        this.#inst=new Promise(x=>this.#resolve = x);
    }
    set_instance(x: MapEditorControl) {this.#resolve(x);}
    async open_map(s:string) {
        (await this.#inst).open_map(s);
    }
}

export const mapEditorControl = new MapEditorControlService();


export const EditorID = {
    GENERAL:1,
    ASSETS:2,
    MAP: 3,
    ITEMS: 4,
    ENEMIES:5,
    SPELLS:6,
    CHARACTERS:7,
    SHOPS:8,
    DIALOGS:9
} as const;

export type EditorRef = typeof EditorID[keyof typeof EditorID];

export interface MainMenuControl {
    open_editor: (editor_id: EditorRef) => void;
}

export class MainMenuControlService {
    #inst: Promise<MainMenuControl>;
    #resolve!: (x:MainMenuControl)=>void;
    constructor() {
        this.#inst=new Promise(x=>this.#resolve = x);
    }
    set_instance(x: MainMenuControl) {this.#resolve(x);}
    async open_editor(editor_id:EditorRef) {
        (await this.#inst).open_editor(editor_id);
    }
}

export const mainMenuControl = new MainMenuControlService();


