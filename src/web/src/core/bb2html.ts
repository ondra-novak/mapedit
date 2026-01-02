export function splitByTags(text: string, tagRegex: RegExp): [boolean, string][] {
    // musí být regex s "global" a "capture group" pro zachycení tagu
    // například /\[\/?[a-z]+\]/gi pro [tag] a [/tag]
    const parts: [boolean, string][] = [];
    let lastIndex = 0;

    // matchAll vrací iterátor všech matchů
    for (const match of text.matchAll(tagRegex)) {
        if (match.index === undefined) continue;
        
        // text před tagem
        if (match.index > lastIndex) {
            parts.push([false,text.substring(lastIndex, match.index)]);
        }

        // samotný tag
        parts.push([true,match[0]]);

        lastIndex = match.index + match[0].length;
    }

    // text za posledním tagem
    if (lastIndex < text.length) {
        parts.push([false,text.substring(lastIndex)]);
    }

    return parts;
}

export function bb2html(s:string) : DocumentFragment{
    const stream = splitByTags(s, /(\[\/?[a-z]+(=[^\]]+)?\])|(\r?\n)|(\[\*\])/gi);
    const fragment = document.createDocumentFragment();
    const stack : [string, Node][] = [];
    let current : Node= fragment;
    let use_next: ((s:string)=>void)|null;

    function pushEl(tag:string, close_tag?:string) : HTMLElement {
        const el = document.createElement(tag);
        current.appendChild(el);
        if (close_tag) {
            stack.push([close_tag, current]);
            current = el;
        }
        return el;
    }

    stream.forEach(itm=>{
        if (itm[0]) {
            const t = itm[1];
            if (t.startsWith("[url=")) {
                const url = t.substring(5, t.length-1);
                const a  = pushEl("A","[/url]") as HTMLAnchorElement;
                a.href = url;
                current = a;
            } else if (t.startsWith("[/")) {
                let found = -1;
                stack.forEach((x,idx)=>{
                    if (x[0] == t) found=idx;
                });
                if (found >= 0) {
                    current = stack[found][1];
                    stack.splice(found);
                }
            } else switch (t) {
                case '\n': pushEl("BR");break;
                case '[b]':pushEl("B","[/b]");break;
                case '[i]':pushEl("I","[/i]");break;
                case '[u]':pushEl("U","[/u]");break;
                case '[code]':pushEl("PRE","[/code]");break;
                case '[hr]': pushEl("HR");break;
                case '[*]': if (stack.length && stack[stack.length-1][0] == '[/list]') {
                    const l = document.createElement("li");
                    current.appendChild(l);
                    current = l;
                }
                break;
                case '[list]': pushEl("UL","[/list]");break;
                case '[img]':
                    const img = pushEl("IMG") as HTMLImageElement;                    
                    use_next = (s:string)=>{                        
                        img.src = s;
                    }                    
                    break;
                case '[url]':
                    const a = pushEl("A","[/url]") as HTMLAnchorElement;               
                    use_next = (s:string)=>{
                        if (!s.startsWith("https://") && !s.startsWith("http://")) {
                            s = "https://"+s;
                        }
                        a.href = s;
                        a.textContent = s;
                    }                    
                    break;
                default: break;
            }

        } else if (use_next) {
            use_next(itm[1]);
            use_next = null;
        } else {
            current.appendChild(document.createTextNode(itm[1]));
        }
    });
    return fragment;
}
