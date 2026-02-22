async function browse_file(filter: string): Promise<{name: string, data: ArrayBuffer, ctxt: string}> {
    return new Promise((succ, cancel)=>{
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = filter;
        input.onchange = (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) {
                cancel(new Error('No file selected'));
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const data = event.target?.result as ArrayBuffer;
                succ({
                    name: file.name,
                    data,
                    ctxt: file.type
                });
            };
            reader.onerror = () => cancel(reader.error);
            reader.readAsArrayBuffer(file);
        };
        input.click();
    })
}

export default browse_file;