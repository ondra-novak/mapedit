import { ref, type Ref } from "vue"

export type MessageBoxData  = {
    message: string;
    buttons: string[];
    selected: (n: number) => void;
    default_button?: number;
    cancel_button?: number;
    title: string;
}

const ask_data = ref<MessageBoxData>();

export async function messageBox(message:string, buttons:string[], default_button? : number, cancel_button?:number, title?:string) : Promise<number> {
    return new Promise((selected)=>{
        ask_data.value = {message, buttons, selected, default_button, cancel_button, title: title ?? "Message"};
    });
}

export function hideMessageBox() {
    ask_data.value = undefined;
}

export function getMessageBoxRefData() : typeof ask_data {
    return ask_data;
}

export async function messageBoxConfirm(message:string) {
    return await messageBox(message,["Yes","No"], 0,1,"Confirm") == 0;
}

export async function messageBoxAlert(message:string) {
    return await messageBox(message,["OK"], 0,0,"Alert");
}
