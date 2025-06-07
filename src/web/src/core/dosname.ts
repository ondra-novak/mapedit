export function make_dosname(name: string, ext?: string): string {
    const sanitize = (s: string) =>
        s.split('').map(c => {
            const code = c.charCodeAt(0);
            return (code >= 32 && code <= 127) ? c : '~';
        }).join('');
    const base = sanitize(name.split('.')[0]);
    const extPart = ext ? sanitize(ext) : "";
    let fin_name = "";
    if (extPart.length + base.length > 12) {
        const l = 12 - extPart.length;
        if (l <0) fin_name = base.substring(0,12);
        else fin_name = base.substring(0,l) + extPart;
    } else {
        fin_name = base + extPart;
    }
    return fin_name;
}