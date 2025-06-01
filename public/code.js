import { loadMapFromURL } from "./map_format.js"
import { drawMap, Location, MapContainer } from "./draw_map.js";



window.loadMapFromURL = loadMapFromURL;
window.drawMap = drawMap;
window.Location = Location;

const cont = new MapContainer(document.getElementById("map_container"));
cont.set_map(drawMap(await loadMapFromURL("./files/maps/SOPKA.MAP"),[],new Location(-2,1,1)));
cont.center();

async function print_event(ev_type) {
    while (true) {
        const val = await cont.on(ev_type);
        console.log(ev_type, val);
    }
}

print_event("single_select");
print_event("draw_line");
print_event("multiple_select");



