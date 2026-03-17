type Coordinate = [number, number];

export function decodePolyline(encoded: string): Coordinate[] {
  const coordinates: Coordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    const latitude = decodeSignedValue(encoded, index);
    index = latitude.nextIndex;
    lat += latitude.value;

    const longitude = decodeSignedValue(encoded, index);
    index = longitude.nextIndex;
    lng += longitude.value;

    coordinates.push([lng / 1e5, lat / 1e5]);
  }

  return coordinates;
}

function decodeSignedValue(
  encoded: string,
  startIndex: number,
): { value: number; nextIndex: number } {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte: number;

  do {
    byte = encoded.charCodeAt(index) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
    index += 1;
  } while (byte >= 0x20 && index < encoded.length);

  const value = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
  return { value, nextIndex: index };
}
