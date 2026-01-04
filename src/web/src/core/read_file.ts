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

export function readFileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error("Unknown image type"));
      img.src = reader.result as string;
    };

    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };

    reader.readAsDataURL(file);
  });
}