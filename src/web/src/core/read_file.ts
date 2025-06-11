export function readFileToArrayBuffer(input:File): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((ok,err)=>{
        const reader = new FileReader();

        reader.readAsArrayBuffer(input);

        reader.onload = function() {
            ok(reader.result as ArrayBuffer);
        };

        reader.onerror = function() {
            err(reader.error);
        }
    });
}