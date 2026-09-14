// 统一城市选项与内置状态判定表
// 用于前端爬虫城市“可选+可填”交互，明确告知用户哪些城市已内置官方代码

export interface ProvinceCityGroup {
  province: string;
  cities: string[];
}

export const HOT_CITIES = [
  '全国',
  '远程',
  '北京',
  '上海',
  '广州',
  '深圳',
  '杭州',
  '成都',
  '武汉',
  '南京',
  '西安',
  '青岛',
  '济南',
  '潍坊',
  '苏州',
  '天津',
  '重庆',
  '长沙',
  '郑州',
  '合肥',
];

export const PROVINCE_CITY_GROUPS: ProvinceCityGroup[] = [
  {
    province: '快捷/特殊',
    cities: ['全国', '远程', '长株潭', '雄安', '顺德'],
  },
  {
    province: '直辖市',
    cities: ['北京', '上海', '天津', '重庆'],
  },
  {
    province: '山东省',
    cities: [
      '济南', '青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁',
      '泰安', '威海', '日照', '临沂', '德州', '聊城', '滨州', '菏泽',
    ],
  },
  {
    province: '江苏省',
    cities: [
      '南京', '无锡', '徐州', '常州', '苏州', '南通', '连云港', '淮安',
      '盐城', '扬州', '镇江', '泰州', '宿迁', '昆山', '太仓', '常熟', '张家港', '江阴',
    ],
  },
  {
    province: '浙江省',
    cities: [
      '杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州',
      '舟山', '台州', '丽水', '义乌', '慈溪', '余姚',
    ],
  },
  {
    province: '湖北省',
    cities: [
      '武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感',
      '荆州', '黄冈', '咸宁', '随州', '恩施', '仙桃', '天门', '潜江', '神农架',
    ],
  },
  {
    province: '湖南省',
    cities: [
      '长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界',
      '益阳', '郴州', '永州', '怀化', '娄底', '湘西',
    ],
  },
  {
    province: '安徽省',
    cities: [
      '合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆',
      '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城',
    ],
  },
  {
    province: '河北省',
    cities: [
      '石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德',
      '沧州', '廊坊', '衡水', '迁安', '辛集', '三河',
    ],
  },
  {
    province: '山西省',
    cities: [
      '太原', '大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城',
      '忻州', '临汾', '吕梁',
    ],
  },
  {
    province: '福建省',
    cities: [
      '福州', '厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩',
      '宁德', '晋江', '石狮', '福清',
    ],
  },
  {
    province: '广东省',
    cities: [
      '广州', '深圳', '珠海', '汕头', '佛山', '韶关', '湛江', '肇庆',
      '江门', '茂名', '惠州', '梅州', '汕尾', '河源', '阳江', '清远',
      '东莞', '中山', '潮州', '揭阳', '云浮',
    ],
  },
  {
    province: '其他核心城市',
    cities: [
      '成都', '绵阳', '西安', '宝鸡', '咸阳', '郑州', '洛阳', '南阳',
      '南昌', '九江', '赣州', '贵阳', '遵义', '昆明', '大理', '南宁',
      '桂林', '海口', '三亚', '沈阳', '大连', '长春', '吉林', '哈尔滨',
      '大庆', '呼和浩特', '包头', '兰州', '银川', '西宁', '乌鲁木齐',
    ],
  },
];

const ALL_CITIES_SET = new Set<string>();
for (const group of PROVINCE_CITY_GROUPS) {
  for (const c of group.cities) {
    ALL_CITIES_SET.add(c);
    const norm = c.replace(/(市|地区|特别行政区|盟|自治州|州)$/, '');
    if (norm) ALL_CITIES_SET.add(norm);
  }
}

/**
 * 判断指定城市是否在系统的官方内置代码库中
 * 纯数字代码亦视作已知有效代码
 */
export function isCitySupported(cityName: string): boolean {
  const trimmed = cityName.trim();
  if (!trimmed) return false;
  if (/^\d+$/.test(trimmed)) return true;
  const norm = trimmed.replace(/(市|地区|特别行政区|盟|自治州|州)$/, '');
  return ALL_CITIES_SET.has(trimmed) || ALL_CITIES_SET.has(norm);
}

/**
 * 联想搜索已支持的城市列表
 */
export function searchSupportedCities(keyword: string, limit = 8): string[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];
  const results: string[] = [];
  for (const city of ALL_CITIES_SET) {
    if (city === '全国' || city === '远程') continue;
    if (city.toLowerCase().includes(q)) {
      results.push(city);
      if (results.length >= limit) break;
    }
  }
  return results;
}
