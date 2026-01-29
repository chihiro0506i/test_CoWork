// Initialize map centered on Tokyo
const map = L.map('map').setView([35.6895, 139.6917], 13);

// Add Dark Mode Tiles (CartoDB Dark Matter)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// State
let startMarker = null;
let destMarker = null;
let routeLine = null;

// UI Elements
const searchBtn = document.getElementById('search-btn');
const startInput = document.getElementById('start-input');
const destInput = document.getElementById('dest-input');
const resultInfo = document.getElementById('result-info');
const distanceVal = document.getElementById('distance-val');
const durationVal = document.getElementById('duration-val');
const errorMsg = document.getElementById('error-msg');

// APIs
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

// Helper: Show Error
function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.add('error-visible');
    resultInfo.classList.add('result-hidden');
}

// Helper: Clear Error
function clearError() {
    errorMsg.classList.remove('error-visible');
    errorMsg.textContent = '';
}

// Helper: Geocode
async function geocode(query) {
    try {
        const response = await fetch(`${NOMINATIM_URL}?format=json&q=${encodeURIComponent(query)}&limit=1`);
        if (!response.ok) throw new Error('Geocoding service error');
        const data = await response.json();
        if (data.length === 0) return null;
        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon),
            display_name: data[0].display_name
        };
    } catch (e) {
        console.error(e);
        return null; // Treated as not found
    }
}

// Helper: Get Route from OSRM
async function getRoute(startCoords, destCoords) {
    // Coords format: lon,lat
    const url = `${OSRM_URL}/${startCoords.lon},${startCoords.lat};${destCoords.lon},${destCoords.lat}?overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Routing service error');
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found');
    }
    
    return data.routes[0];
}

// Main Search Function
async function handleSearch() {
    const startQuery = startInput.value.trim();
    const destQuery = destInput.value.trim();

    if (!startQuery || !destQuery) {
        showError('出発地と目的地を入力してください');
        return;
    }

    clearError();
    searchBtn.textContent = '検索中...';
    searchBtn.disabled = true;

    try {
        // 1. Geocode both locations
        const [startLoc, destLoc] = await Promise.all([
            geocode(startQuery),
            geocode(destQuery)
        ]);

        if (!startLoc) {
            throw new Error(`「${startQuery}」が見つかりませんでした`);
        }
        if (!destLoc) {
            throw new Error(`「${destQuery}」が見つかりませんでした`);
        }

        // 2. Clear previous items
        if (startMarker) map.removeLayer(startMarker);
        if (destMarker) map.removeLayer(destMarker);
        if (routeLine) map.removeLayer(routeLine);

        // 3. Add Markets
        startMarker = L.marker([startLoc.lat, startLoc.lon], {title: '出発地'}).addTo(map);
        destMarker = L.marker([destLoc.lat, destLoc.lon], {title: '目的地'}).addTo(map);

        // 4. Get Route
        const route = await getRoute(startLoc, destLoc);

        // 5. Draw Route Line
        // GeoJSON coordinates are [lon, lat], Leaflet wants [lat, lon]. 
        // L.geoJSON handles this automatically if standard GeoJSON is passed.
        routeLine = L.geoJSON(route.geometry, {
            style: {
                color: '#3b82f6',
                weight: 6,
                opacity: 0.8
            }
        }).addTo(map);

        // 6. Fit Bounds
        map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

        // 7. Show Results
        const distKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);
        
        distanceVal.textContent = `${distKm} km`;
        durationVal.textContent = `${durationMin} 分`;
        resultInfo.classList.remove('result-hidden');

    } catch (err) {
        showError(err.message);
    } finally {
        searchBtn.textContent = '経路を検索';
        searchBtn.disabled = false;
    }
}

// Event Listeners
searchBtn.addEventListener('click', handleSearch);

// Allow Enter key to search
[startInput, destInput].forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
});
