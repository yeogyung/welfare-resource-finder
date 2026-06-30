const DEFAULT_LOCATION = "서울 광진구";

const DISTRICTS = [
  "강남구",
  "강동구",
  "강북구",
  "강서구",
  "관악구",
  "광진구",
  "구로구",
  "금천구",
  "노원구",
  "도봉구",
  "동대문구",
  "동작구",
  "마포구",
  "서대문구",
  "서초구",
  "성동구",
  "성북구",
  "송파구",
  "양천구",
  "영등포구",
  "용산구",
  "은평구",
  "종로구",
  "중구",
  "중랑구"
];

const CITIES = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "제주",
  "수원",
  "성남",
  "고양",
  "용인",
  "부천",
  "안산",
  "안양",
  "남양주",
  "화성",
  "의정부",
  "시흥",
  "김포",
  "파주",
  "광명",
  "군포",
  "하남",
  "오산",
  "이천",
  "구리"
];

const KNOWN_PLACES = {
  "서울": { name: "서울", admin1: "서울특별시", latitude: 37.5665, longitude: 126.9780 },
  "서울 강남구": { name: "강남구", admin1: "서울특별시", latitude: 37.5172, longitude: 127.0473 },
  "서울 강동구": { name: "강동구", admin1: "서울특별시", latitude: 37.5301, longitude: 127.1238 },
  "서울 강북구": { name: "강북구", admin1: "서울특별시", latitude: 37.6396, longitude: 127.0257 },
  "서울 강서구": { name: "강서구", admin1: "서울특별시", latitude: 37.5509, longitude: 126.8495 },
  "서울 관악구": { name: "관악구", admin1: "서울특별시", latitude: 37.4784, longitude: 126.9516 },
  "서울 광진구": { name: "광진구", admin1: "서울특별시", latitude: 37.5384, longitude: 127.0823 },
  "서울 구로구": { name: "구로구", admin1: "서울특별시", latitude: 37.4955, longitude: 126.8877 },
  "서울 금천구": { name: "금천구", admin1: "서울특별시", latitude: 37.4569, longitude: 126.8958 },
  "서울 노원구": { name: "노원구", admin1: "서울특별시", latitude: 37.6542, longitude: 127.0568 },
  "서울 도봉구": { name: "도봉구", admin1: "서울특별시", latitude: 37.6688, longitude: 127.0471 },
  "서울 동대문구": { name: "동대문구", admin1: "서울특별시", latitude: 37.5744, longitude: 127.0396 },
  "서울 동작구": { name: "동작구", admin1: "서울특별시", latitude: 37.5124, longitude: 126.9393 },
  "서울 마포구": { name: "마포구", admin1: "서울특별시", latitude: 37.5663, longitude: 126.9019 },
  "서울 서대문구": { name: "서대문구", admin1: "서울특별시", latitude: 37.5791, longitude: 126.9368 },
  "서울 서초구": { name: "서초구", admin1: "서울특별시", latitude: 37.4836, longitude: 127.0326 },
  "서울 성동구": { name: "성동구", admin1: "서울특별시", latitude: 37.5633, longitude: 127.0369 },
  "서울 성북구": { name: "성북구", admin1: "서울특별시", latitude: 37.5894, longitude: 127.0167 },
  "서울 송파구": { name: "송파구", admin1: "서울특별시", latitude: 37.5145, longitude: 127.1059 },
  "서울 양천구": { name: "양천구", admin1: "서울특별시", latitude: 37.5169, longitude: 126.8664 },
  "서울 영등포구": { name: "영등포구", admin1: "서울특별시", latitude: 37.5264, longitude: 126.8962 },
  "서울 용산구": { name: "용산구", admin1: "서울특별시", latitude: 37.5326, longitude: 126.9904 },
  "서울 은평구": { name: "은평구", admin1: "서울특별시", latitude: 37.6027, longitude: 126.9291 },
  "서울 종로구": { name: "종로구", admin1: "서울특별시", latitude: 37.5735, longitude: 126.9788 },
  "서울 중구": { name: "중구", admin1: "서울특별시", latitude: 37.5636, longitude: 126.9976 },
  "서울 중랑구": { name: "중랑구", admin1: "서울특별시", latitude: 37.6063, longitude: 127.0925 },
  "부산": { name: "부산", admin1: "부산광역시", latitude: 35.1796, longitude: 129.0756 },
  "대구": { name: "대구", admin1: "대구광역시", latitude: 35.8714, longitude: 128.6014 },
  "인천": { name: "인천", admin1: "인천광역시", latitude: 37.4563, longitude: 126.7052 },
  "광주": { name: "광주", admin1: "광주광역시", latitude: 35.1595, longitude: 126.8526 },
  "대전": { name: "대전", admin1: "대전광역시", latitude: 36.3504, longitude: 127.3845 },
  "울산": { name: "울산", admin1: "울산광역시", latitude: 35.5384, longitude: 129.3114 },
  "세종": { name: "세종", admin1: "세종특별자치시", latitude: 36.4800, longitude: 127.2890 },
  "제주": { name: "제주", admin1: "제주특별자치도", latitude: 33.4996, longitude: 126.5312 }
};

function setJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        resolve({});
      }
    });
  });
}

function pickLocation(input) {
  const text = String(input || "");
  const district = DISTRICTS.find((name) => text.includes(name));
  if (district) {
    return text.includes("서울") ? `서울 ${district}` : `서울 ${district}`;
  }
  const city = CITIES.find((name) => text.includes(name));
  return city || DEFAULT_LOCATION;
}

function weatherLabel(code) {
  if (code === 0) return "맑음";
  if ([1, 2].includes(code)) return "구름 조금";
  if (code === 3) return "흐림";
  if ([45, 48].includes(code)) return "안개";
  if ([51, 53, 55, 56, 57].includes(code)) return "이슬비";
  if ([61, 63, 65, 66, 67].includes(code)) return "비";
  if ([71, 73, 75, 77].includes(code)) return "눈";
  if ([80, 81, 82].includes(code)) return "소나기";
  if ([85, 86].includes(code)) return "눈 소나기";
  if ([95, 96, 99].includes(code)) return "천둥번개";
  return "날씨 변화";
}

function isRainy(code, precipitation, rain) {
  return precipitation > 0 || rain > 0 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code);
}

function makeAdvice({ code, apparentTemperature, precipitation, rain, windSpeed }) {
  if (isRainy(code, precipitation, rain)) {
    return "비가 올 수 있어요. 우산을 챙기시고, 이동이 불편하면 실내 모임이나 복지관 프로그램을 먼저 보셔도 좋아요.";
  }
  if (apparentTemperature >= 30) {
    return "많이 더울 수 있어요. 물을 자주 드시고, 오래 걷는 일정은 피하시는 편이 좋아요.";
  }
  if (apparentTemperature <= 0) {
    return "춥게 느껴질 수 있어요. 따뜻하게 입고, 길이 미끄럽지 않은지 조심해 주세요.";
  }
  if (windSpeed >= 9) {
    return "바람이 조금 강할 수 있어요. 외출하실 때 겉옷을 챙기시면 좋아요.";
  }
  return "외출하기 무난한 편이에요. 원하시면 가까운 모임이나 배움 활동도 같이 찾아드릴게요.";
}

async function geocode(location) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", location);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "ko");
  url.searchParams.set("format", "json");

  const response = await fetch(url);
  if (!response.ok) throw new Error("geocode_failed");
  const data = await response.json();
  const first = data && data.results && data.results[0];
  if (!first) throw new Error("location_not_found");
  return first;
}

async function resolvePlace(location) {
  if (KNOWN_PLACES[location]) return KNOWN_PLACES[location];

  const district = DISTRICTS.find((name) => location.includes(name));
  if (district && KNOWN_PLACES[`서울 ${district}`]) return KNOWN_PLACES[`서울 ${district}`];

  const city = CITIES.find((name) => location.includes(name));
  if (city && KNOWN_PLACES[city]) return KNOWN_PLACES[city];

  try {
    return await geocode(location);
  } catch (error) {
    return KNOWN_PLACES[DEFAULT_LOCATION];
  }
}

async function currentWeather(place) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m"
  );
  url.searchParams.set("timezone", "Asia/Seoul");

  const response = await fetch(url);
  if (!response.ok) throw new Error("weather_failed");
  const data = await response.json();
  if (!data || !data.current) throw new Error("weather_empty");
  return data.current;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const body = req.method === "POST" ? await parseBody(req) : {};
    const queryLocation = req.query && (req.query.location || req.query.query);
    const requested = pickLocation(body.location || body.query || queryLocation);
    const place = await resolvePlace(requested);
    const current = await currentWeather(place);

    const temperature = Number(current.temperature_2m);
    const apparentTemperature = Number(current.apparent_temperature);
    const humidity = Number(current.relative_humidity_2m);
    const precipitation = Number(current.precipitation || 0);
    const rain = Number(current.rain || 0);
    const windSpeed = Number(current.wind_speed_10m || 0);
    const weatherCode = Number(current.weather_code);
    const condition = weatherLabel(weatherCode);
    const advice = makeAdvice({ code: weatherCode, apparentTemperature, precipitation, rain, windSpeed });
    const locationName = [place.admin1, place.name].filter(Boolean).join(" ");

    setJson(res, 200, {
      source: "open-meteo",
      location: requested,
      locationName,
      latitude: place.latitude,
      longitude: place.longitude,
      temperature,
      apparentTemperature,
      humidity,
      precipitation,
      rain,
      windSpeed,
      weatherCode,
      condition,
      advice,
      summary: `${locationName || requested} 현재 날씨는 ${condition}, ${temperature}도입니다. 체감은 ${apparentTemperature}도예요. ${advice}`
    });
  } catch (error) {
    setJson(res, 502, {
      error: "weather_unavailable",
      message: "날씨 정보를 불러오지 못했습니다."
    });
  }
};
