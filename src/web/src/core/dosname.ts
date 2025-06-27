export function dosname_sanitize(name: string) {
    return name.split('').map(c => {
        const code = c.charCodeAt(0);        
        return (code >= 33 && code <= 127) ? c : code < 33 ? "_" : '~';
    }).join('').toUpperCase();
}

export function make_dosname(name: string, ext?: string): string {
    const base = dosname_sanitize(name.split('.')[0]);
    const extPart = ext ? dosname_sanitize(ext) : "";
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