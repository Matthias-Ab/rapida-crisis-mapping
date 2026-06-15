// Keyword-based NLP parser: maps a voice transcript to RAPIDA form fields.
// Each category has keyword lists per supported language so the parser works
// regardless of which UN language the Speech API transcribes in.

const DAMAGE_KEYWORDS = {
  complete: {
    en: ['collapsed', 'collapse', 'destroyed', 'demolished', 'ruins', 'fallen', 'rubble', 'completely destroyed', 'total loss', 'wiped out', 'crushed', 'crumbled', 'levelled', 'leveled'],
    fr: ['effondré', 'effondrement', 'détruit', 'démoli', 'ruines', 'tombé', 'complètement détruit', 'totalement détruit', 'écrasé', 'décombres'],
    es: ['derrumbado', 'derrumbe', 'destruido', 'demolido', 'ruinas', 'caído', 'completamente destruido', 'aplastado', 'escombros'],
    ar: ['منهار', 'انهيار', 'مدمر', 'هدم', 'أنقاض', 'سقط', 'دمار كامل', 'محطم'],
    zh: ['倒塌', '摧毁', '坍塌', '废墟', '完全损毁'],
    ru: ['обрушился', 'разрушен', 'снесён', 'руины', 'упал', 'полностью разрушен', 'обломки', 'завалило']
  },
  partial: {
    en: ['damaged', 'cracked', 'broken', 'partially', 'structural damage', 'leaning', 'tilted', 'compromised', 'unstable', 'partial'],
    fr: ['endommagé', 'fissuré', 'cassé', 'partiellement', 'dommages structurels', 'incliné', 'instable'],
    es: ['dañado', 'agrietado', 'roto', 'parcialmente', 'daños estructurales', 'inclinado', 'inestable'],
    ar: ['متضرر', 'متشقق', 'مكسور', 'جزئياً', 'أضرار هيكلية', 'مائل', 'غير مستقر'],
    zh: ['受损', '裂缝', '破损', '部分', '结构损坏', '倾斜', '不稳定'],
    ru: ['поврежден', 'треснул', 'сломан', 'частично', 'структурные повреждения', 'наклонился', 'неустойчив']
  }
}

const INFRA_KEYWORDS = {
  residential: {
    en: ['house', 'home', 'apartment', 'flat', 'condo', 'residential', 'dwelling', 'villa', 'housing', 'family home', 'building', 'block of flats'],
    fr: ['maison', 'appartement', 'domicile', 'résidentiel', 'villa', 'habitation', 'logement', 'immeuble'],
    es: ['casa', 'apartamento', 'piso', 'residencial', 'villa', 'vivienda', 'hogar', 'edificio'],
    ar: ['منزل', 'بيت', 'شقة', 'سكني', 'مبنى سكني', 'فيلا', 'مسكن'],
    zh: ['房屋', '住宅', '公寓', '住所', '民房'],
    ru: ['дом', 'квартира', 'жилой', 'жилище', 'вилла', 'многоквартирный']
  },
  commercial: {
    en: ['shop', 'store', 'market', 'office', 'commercial', 'business', 'mall', 'warehouse', 'factory', 'bank', 'restaurant', 'hotel'],
    fr: ['magasin', 'boutique', 'marché', 'bureau', 'commercial', 'centre commercial', 'entrepôt', 'usine', 'banque', 'restaurant', 'hôtel'],
    es: ['tienda', 'mercado', 'oficina', 'comercial', 'centro comercial', 'almacén', 'fábrica', 'banco', 'restaurante', 'hotel'],
    ar: ['محل', 'متجر', 'سوق', 'مكتب', 'تجاري', 'مول', 'مستودع', 'مصنع', 'بنك', 'مطعم', 'فندق'],
    zh: ['商店', '市场', '办公室', '商业', '商场', '仓库', '工厂', '银行', '餐厅', '酒店'],
    ru: ['магазин', 'рынок', 'офис', 'коммерческий', 'торговый центр', 'склад', 'завод', 'банк', 'ресторан', 'отель']
  },
  government: {
    en: ['government', 'ministry', 'courthouse', 'police', 'fire station', 'city hall', 'municipal', 'official', 'administrative', 'embassy'],
    fr: ['gouvernement', 'ministère', 'tribunal', 'police', 'mairie', 'municipal', 'administratif', 'ambassade'],
    es: ['gobierno', 'ministerio', 'tribunal', 'policía', 'ayuntamiento', 'municipal', 'administrativo', 'embajada'],
    ar: ['حكومة', 'وزارة', 'محكمة', 'شرطة', 'بلدية', 'رسمي', 'إداري', 'سفارة'],
    zh: ['政府', '部委', '法院', '警察', '市政', '行政', '大使馆'],
    ru: ['правительство', 'министерство', 'суд', 'полиция', 'мэрия', 'муниципальный', 'административный', 'посольство']
  },
  utility: {
    en: ['power plant', 'electricity', 'gas', 'sewage', 'pipeline', 'tower', 'utility', 'substation', 'transformer', 'water plant', 'water treatment'],
    fr: ['centrale', 'électricité', 'gaz', 'égouts', 'pipeline', 'tour', 'réseau', 'sous-station', 'traitement des eaux'],
    es: ['central', 'electricidad', 'gas', 'alcantarilla', 'tubería', 'torre', 'subestación', 'tratamiento de agua'],
    ar: ['محطة كهرباء', 'كهرباء', 'غاز', 'صرف', 'أنابيب', 'برج', 'محطة تحويل'],
    zh: ['发电厂', '电力', '燃气', '污水', '管道', '塔', '变电站'],
    ru: ['электростанция', 'электричество', 'газ', 'канализация', 'трубопровод', 'башня', 'подстанция']
  },
  transport: {
    en: ['road', 'bridge', 'highway', 'street', 'railway', 'airport', 'overpass', 'tunnel', 'port', 'transport', 'intersection', 'underpass'],
    fr: ['route', 'pont', 'autoroute', 'rue', 'chemin de fer', 'aéroport', 'viaduc', 'tunnel', 'port'],
    es: ['carretera', 'puente', 'autopista', 'calle', 'ferrocarril', 'aeropuerto', 'viaducto', 'túnel', 'puerto'],
    ar: ['طريق', 'جسر', 'طريق سريع', 'شارع', 'سكة حديد', 'مطار', 'نفق', 'ميناء'],
    zh: ['道路', '桥梁', '高速公路', '街道', '铁路', '机场', '隧道', '港口'],
    ru: ['дорога', 'мост', 'шоссе', 'улица', 'железная дорога', 'аэропорт', 'тоннель', 'порт']
  },
  community: {
    en: ['school', 'hospital', 'clinic', 'church', 'mosque', 'temple', 'community center', 'university', 'college', 'library', 'community'],
    fr: ['école', 'hôpital', 'clinique', 'église', 'mosquée', 'temple', 'centre communautaire', 'université', 'bibliothèque'],
    es: ['escuela', 'hospital', 'clínica', 'iglesia', 'mezquita', 'templo', 'centro comunitario', 'universidad', 'biblioteca'],
    ar: ['مدرسة', 'مستشفى', 'عيادة', 'كنيسة', 'مسجد', 'معبد', 'مركز مجتمعي', 'جامعة', 'مكتبة'],
    zh: ['学校', '医院', '诊所', '教堂', '清真寺', '寺庙', '社区中心', '大学', '图书馆'],
    ru: ['школа', 'больница', 'клиника', 'церковь', 'мечеть', 'храм', 'общественный центр', 'университет', 'библиотека']
  },
  recreation: {
    en: ['park', 'stadium', 'gym', 'recreation', 'sports', 'playground', 'arena', 'field', 'court'],
    fr: ['parc', 'stade', 'gymnase', 'sports', 'terrain de jeux', 'arène', 'terrain'],
    es: ['parque', 'estadio', 'gimnasio', 'deportes', 'parque infantil', 'arena', 'campo'],
    ar: ['حديقة', 'ملعب', 'صالة رياضية', 'رياضة', 'ملعب أطفال', 'ميدان'],
    zh: ['公园', '体育场', '健身房', '体育', '操场', '竞技场', '球场'],
    ru: ['парк', 'стадион', 'спортзал', 'спорт', 'игровая площадка', 'арена', 'поле']
  }
}

const CRISIS_KEYWORDS = {
  earthquake: {
    en: ['earthquake', 'tremor', 'seismic', 'quake', 'aftershock', 'shaking', 'ground shook'],
    fr: ['tremblement de terre', 'séisme', 'secousse', 'réplique', 'tremblement'],
    es: ['terremoto', 'sismo', 'temblor', 'sacudida', 'réplica'],
    ar: ['زلزال', 'هزة أرضية', 'زلزالي', 'ارتجاج', 'هزة ارتدادية'],
    zh: ['地震', '余震', '震动', '地震活动'],
    ru: ['землетрясение', 'толчок', 'сейсмический', 'подземный удар', 'афтершок']
  },
  flood: {
    en: ['flood', 'flooding', 'inundated', 'submerged', 'water level', 'overflow', 'flash flood', 'waterlogged'],
    fr: ['inondation', 'inondé', 'submergé', 'niveau d\'eau', 'débordement', 'crue'],
    es: ['inundación', 'inundado', 'sumergido', 'nivel del agua', 'desbordamiento', 'riada'],
    ar: ['فيضان', 'غمر', 'مغمور', 'مستوى الماء', 'سيل'],
    zh: ['洪水', '洪涝', '淹没', '水位', '泛滥', '山洪'],
    ru: ['наводнение', 'затопление', 'залит', 'уровень воды', 'разлив', 'паводок']
  },
  wildfire: {
    en: ['fire', 'wildfire', 'burning', 'flames', 'forest fire', 'blaze', 'smoke', 'on fire'],
    fr: ['feu', 'incendie', 'flammes', 'feu de forêt', 'brasier', 'fumée'],
    es: ['fuego', 'incendio', 'llamas', 'incendio forestal', 'humo', 'ardiendo'],
    ar: ['حريق', 'حرائق', 'لهب', 'حريق الغابة', 'دخان', 'يحترق'],
    zh: ['火灾', '野火', '火焰', '森林火灾', '烟雾', '着火'],
    ru: ['пожар', 'лесной пожар', 'горит', 'пламя', 'дым', 'огонь']
  },
  explosion: {
    en: ['explosion', 'blast', 'bomb', 'detonation', 'exploded', 'blew up', 'gas explosion', 'detonated'],
    fr: ['explosion', 'déflagration', 'bombe', 'détonation', 'explosé'],
    es: ['explosión', 'detonación', 'bomba', 'estalló', 'explosionó'],
    ar: ['انفجار', 'تفجير', 'قنبلة', 'انفجر'],
    zh: ['爆炸', '炸弹', '引爆', '爆炸了'],
    ru: ['взрыв', 'подрыв', 'бомба', 'детонация', 'взорвался']
  },
  hurricane: {
    en: ['hurricane', 'cyclone', 'typhoon', 'storm', 'tornado', 'strong wind', 'windstorm', 'gale'],
    fr: ['ouragan', 'cyclone', 'typhon', 'tempête', 'tornade', 'vent fort'],
    es: ['huracán', 'ciclón', 'tifón', 'tormenta', 'tornado', 'viento fuerte'],
    ar: ['إعصار', 'عاصفة', 'طوفان', 'رياح قوية'],
    zh: ['飓风', '气旋', '台风', '风暴', '龙卷风'],
    ru: ['ураган', 'циклон', 'тайфун', 'шторм', 'торнадо']
  },
  tsunami: {
    en: ['tsunami', 'tidal wave', 'sea wave'],
    fr: ['tsunami', 'raz-de-marée'],
    es: ['tsunami', 'maremoto'],
    ar: ['تسونامي', 'موجة مد'],
    zh: ['海啸', '潮汐波'],
    ru: ['цунами', 'приливная волна']
  },
  chemical: {
    en: ['chemical', 'gas leak', 'toxic', 'spill', 'hazmat', 'radiation', 'nuclear', 'contamination', 'poison', 'fumes'],
    fr: ['chimique', 'fuite de gaz', 'toxique', 'déversement', 'radiation', 'nucléaire', 'contamination'],
    es: ['químico', 'fuga de gas', 'tóxico', 'derrame', 'radiación', 'nuclear', 'contaminación'],
    ar: ['كيميائي', 'تسرب غاز', 'سام', 'انسكاب', 'إشعاع', 'نووي', 'تلوث'],
    zh: ['化学', '气体泄漏', '有毒', '泄漏', '辐射', '核', '污染'],
    ru: ['химический', 'утечка газа', 'токсичный', 'разлив', 'радиация', 'ядерный', 'загрязнение']
  },
  conflict: {
    en: ['conflict', 'shooting', 'attack', 'bombing', 'violence', 'warfare', 'military', 'gunfire', 'artillery', 'shelling'],
    fr: ['conflit', 'tirs', 'attaque', 'bombardement', 'violence', 'guerre', 'militaire'],
    es: ['conflicto', 'disparos', 'ataque', 'bombardeo', 'violencia', 'guerra', 'militar'],
    ar: ['نزاع', 'إطلاق نار', 'هجوم', 'قصف', 'عنف', 'حرب', 'عسكري'],
    zh: ['冲突', '枪击', '袭击', '轰炸', '暴力', '战争', '军事'],
    ru: ['конфликт', 'стрельба', 'атака', 'бомбардировка', 'насилие', 'война', 'военный']
  },
  civil_unrest: {
    en: ['riot', 'protest', 'civil unrest', 'looting', 'demonstration', 'mob', 'disturbance'],
    fr: ['émeute', 'protestation', 'troubles civils', 'pillage', 'manifestation'],
    es: ['disturbio', 'protesta', 'agitación civil', 'saqueo', 'manifestación'],
    ar: ['شغب', 'احتجاج', 'اضطرابات مدنية', 'نهب', 'مظاهرة'],
    zh: ['暴乱', '抗议', '民乱', '抢劫', '示威'],
    ru: ['беспорядки', 'протест', 'гражданские беспорядки', 'мародерство', 'демонстрация']
  }
}

const NEEDS_KEYWORDS = {
  water: {
    en: ['water', 'drinking water', 'thirsty', 'dehydrated', 'no water', 'potable'],
    fr: ['eau', 'eau potable', 'soif', 'déshydraté', 'pas d\'eau'],
    es: ['agua', 'agua potable', 'sed', 'deshidratado', 'sin agua'],
    ar: ['ماء', 'مياه شرب', 'عطش', 'جفاف', 'بلا ماء'],
    zh: ['水', '饮用水', '口渴', '脱水', '没有水'],
    ru: ['вода', 'питьевая вода', 'жажда', 'обезвожен', 'нет воды']
  },
  food: {
    en: ['food', 'hunger', 'hungry', 'starving', 'no food', 'supplies', 'rations'],
    fr: ['nourriture', 'faim', 'affamé', 'famine', 'pas de nourriture'],
    es: ['comida', 'hambre', 'hambriento', 'sin comida', 'suministros'],
    ar: ['طعام', 'جوع', 'جائع', 'مجاعة', 'بلا طعام'],
    zh: ['食物', '饥饿', '饥饿的', '没有食物', '物资'],
    ru: ['еда', 'голод', 'голодный', 'нет еды', 'продовольствие']
  },
  shelter: {
    en: ['shelter', 'homeless', 'displaced', 'nowhere to go', 'evacuation', 'accommodation', 'no roof'],
    fr: ['abri', 'sans-abri', 'déplacé', 'nulle part', 'évacuation', 'hébergement'],
    es: ['refugio', 'sin hogar', 'desplazado', 'evacuación', 'alojamiento'],
    ar: ['مأوى', 'بلا مأوى', 'نازح', 'إخلاء', 'سكن'],
    zh: ['避难所', '无家可归', '流离失所', '撤离', '住所'],
    ru: ['укрытие', 'бездомный', 'перемещен', 'эвакуация', 'жилье']
  },
  medical: {
    en: ['medical', 'doctor', 'nurse', 'ambulance', 'injured', 'wounded', 'bleeding', 'hospital', 'medicine', 'hurt', 'casualties', 'first aid'],
    fr: ['médical', 'médecin', 'infirmier', 'ambulance', 'blessé', 'saignement', 'hôpital', 'médicament'],
    es: ['médico', 'doctor', 'enfermero', 'ambulancia', 'herido', 'hemorragia', 'hospital', 'medicina'],
    ar: ['طبي', 'طبيب', 'ممرض', 'إسعاف', 'مصاب', 'نزيف', 'مستشفى', 'دواء'],
    zh: ['医疗', '医生', '护士', '救护车', '受伤', '出血', '医院', '药物'],
    ru: ['медицина', 'врач', 'медсестра', 'скорая', 'ранен', 'кровотечение', 'больница', 'лекарство']
  },
  rescue: {
    en: ['rescue', 'trapped', 'buried', 'stuck', 'help', 'people inside', 'survivors', 'missing', 'search', 'victims', 'under rubble'],
    fr: ['sauvetage', 'piégé', 'enterré', 'coincé', 'aide', 'personnes à l\'intérieur', 'survivants', 'disparu'],
    es: ['rescate', 'atrapado', 'enterrado', 'bloqueado', 'ayuda', 'personas dentro', 'sobrevivientes', 'desaparecido'],
    ar: ['إنقاذ', 'محاصر', 'مدفون', 'عالق', 'مساعدة', 'أشخاص داخل', 'ناجون', 'مفقود'],
    zh: ['救援', '被困', '埋压', '卡住', '帮助', '里面有人', '幸存者', '失踪'],
    ru: ['спасение', 'заперт', 'погребен', 'застрял', 'помощь', 'люди внутри', 'выжившие', 'пропавшие']
  },
  electricity: {
    en: ['electricity', 'power', 'lights', 'generator', 'blackout', 'no power', 'outage', 'dark'],
    fr: ['électricité', 'courant', 'lumières', 'générateur', 'panne', 'coupure', 'sombre'],
    es: ['electricidad', 'energía', 'luces', 'generador', 'apagón', 'sin energía'],
    ar: ['كهرباء', 'طاقة', 'أضواء', 'مولد', 'انقطاع', 'بلا كهرباء'],
    zh: ['电力', '电源', '灯', '发电机', '停电', '没有电'],
    ru: ['электричество', 'свет', 'генератор', 'отключение', 'нет света']
  },
  communication: {
    en: ['communication', 'phone', 'signal', 'internet', 'radio', 'network', 'no signal', 'cell service'],
    fr: ['communication', 'téléphone', 'signal', 'internet', 'radio', 'réseau'],
    es: ['comunicación', 'teléfono', 'señal', 'internet', 'radio', 'red'],
    ar: ['اتصالات', 'هاتف', 'إشارة', 'إنترنت', 'راديو', 'شبكة'],
    zh: ['通信', '电话', '信号', '互联网', '无线电', '网络'],
    ru: ['связь', 'телефон', 'сигнал', 'интернет', 'радио', 'сеть']
  },
  sanitation: {
    en: ['sanitation', 'toilet', 'hygiene', 'sewage', 'waste', 'latrine', 'clean water'],
    fr: ['assainissement', 'toilette', 'hygiène', 'égouts', 'déchets'],
    es: ['saneamiento', 'inodoro', 'higiene', 'alcantarilla', 'residuos'],
    ar: ['صرف صحي', 'مرحاض', 'نظافة', 'مجاري', 'نفايات'],
    zh: ['卫生', '厕所', '卫生设施', '污水', '废物'],
    ru: ['санитария', 'туалет', 'гигиена', 'канализация', 'отходы']
  }
}

function countMatches(text, keywords) {
  const lower = text.toLowerCase()
  return keywords.reduce((n, kw) => n + (lower.includes(kw.toLowerCase()) ? 1 : 0), 0)
}

function bestMatch(text, categoryMap, lang) {
  let best = null
  let bestScore = 0
  for (const [key, langMap] of Object.entries(categoryMap)) {
    const kws = langMap[lang] || langMap.en
    const score = countMatches(text, kws)
    if (score > bestScore) { bestScore = score; best = key }
  }
  return bestScore > 0 ? best : null
}

export function parseVoiceInput(transcript, language = 'en') {
  if (!transcript?.trim()) return {}
  const lang = (language in DAMAGE_KEYWORDS.complete) ? language : 'en'
  const lower = transcript.toLowerCase()

  const completeScore = countMatches(lower, DAMAGE_KEYWORDS.complete[lang] || DAMAGE_KEYWORDS.complete.en)
  const partialScore = countMatches(lower, DAMAGE_KEYWORDS.partial[lang] || DAMAGE_KEYWORDS.partial.en)
  let damageLevel = null
  if (completeScore > 0 && completeScore >= partialScore) damageLevel = 'complete'
  else if (partialScore > 0) damageLevel = 'partial'

  const needsWithScores = Object.entries(NEEDS_KEYWORDS).map(([need, langMap]) => ({
    need,
    score: countMatches(lower, langMap[lang] || langMap.en)
  })).filter((n) => n.score > 0).sort((a, b) => b.score - a.score)

  return {
    damageLevel,
    infraType: bestMatch(lower, INFRA_KEYWORDS, lang),
    crisisType: bestMatch(lower, CRISIS_KEYWORDS, lang),
    pressingNeeds: needsWithScores.slice(0, 3).map((n) => n.need),
    description: transcript.trim().slice(0, 500)
  }
}

const DAMAGE_LABEL = { complete: 'damage_complete', partial: 'damage_partial', none: 'damage_none' }
const INFRA_LABEL = {
  residential: 'infra_residential', commercial: 'infra_commercial', government: 'infra_government',
  utility: 'infra_utility', transport: 'infra_transport', community: 'infra_community',
  recreation: 'infra_recreation', other: 'infra_other'
}
const CRISIS_LABEL = {
  earthquake: 'crisis_earthquake', flood: 'crisis_flood', tsunami: 'crisis_tsunami',
  hurricane: 'crisis_hurricane', wildfire: 'crisis_wildfire', explosion: 'crisis_explosion',
  chemical: 'crisis_chemical', conflict: 'crisis_conflict', civil_unrest: 'crisis_civil_unrest'
}
const NEED_EMOJI = { water: '💧', food: '🍲', shelter: '🏠', medical: '🩺', rescue: '🚁', electricity: '⚡', communication: '📡', sanitation: '🚿' }
const NEED_LABEL = {
  water: 'need_water', food: 'need_food', shelter: 'need_shelter', medical: 'need_medical',
  rescue: 'need_rescue', electricity: 'need_electricity', communication: 'need_communication', sanitation: 'need_sanitation'
}

export function summarizeDetected(parsed, t) {
  const items = []
  if (parsed.damageLevel) items.push({ icon: '💥', label: t(DAMAGE_LABEL[parsed.damageLevel]) })
  if (parsed.infraType) items.push({ icon: '🏗️', label: t(INFRA_LABEL[parsed.infraType] || 'infra_other') })
  if (parsed.crisisType) items.push({ icon: '⚠️', label: t(CRISIS_LABEL[parsed.crisisType] || 'crisis_natural') })
  parsed.pressingNeeds?.forEach((need) => {
    items.push({ icon: NEED_EMOJI[need] || '•', label: t(NEED_LABEL[need] || need) })
  })
  return items
}
