export interface ProgressBarIfc {
    set_value:(value:number) => void;
    set_text:(text:string) => void;
    set_title:(text:string) => void;
    set_error_state:(err: boolean) => void;    
    //shows cancel button and call callback when pressed
    set_cancel_callback:(cb:()=>void) => void;
    //close dialog
    close:()=>void;
    //leave dialog open, show close button
    close_by_user:()=>void;
    open:()=>void;
};


class ProgressBar {

    static cur_progress_bar_fn : ((x:ProgressBarIfc)=>void)|null = null;
    static cur_progress_bar_impl : Promise<ProgressBarIfc> = new Promise<ProgressBarIfc>((ok)=>{
        ProgressBar.cur_progress_bar_fn = ok;
    });

    static async open() {
        const impl = await this.cur_progress_bar_impl;
        impl.open();
        return impl;
    }
    static set_implementation(x: ProgressBarIfc) {
        const f = ProgressBar.cur_progress_bar_fn!;
        f(x);
    }
    
};

export default ProgressBar;