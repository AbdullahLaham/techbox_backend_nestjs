// prisma/seed-data/english-levels/assignments.ts
// Two assignments per level: a writing task answered in text (TEXT_CONTENT) and a practical
// task handed in as a file (FILE_UPLOAD). Each one has an illustration in ./images, uploaded as
// its attachment by scripts/upload-english-assignment-images.ts.

export type SeedAssignmentType = 'TEXT_CONTENT' | 'FILE_UPLOAD';

export type SeedAssignment = {
  /** 1–12 */
  level: number;
  /** Module of the level the assignment follows (0–2). */
  moduleIndex: number;
  type: SeedAssignmentType;
  title: string;
  titleAr: string;
  /** What to do, in Arabic. */
  task: string;
  requirements: string[];
  /** A model opening in English, to show the expected style. */
  example?: string;
  /** [criterion, points]; the points add up to 100. */
  criteria: [string, number][];
  /** Lucide icon drawn on the illustration. */
  icon: string;
};

export const CEFR_BY_LEVEL = [
  'A1',
  'A1',
  'A2',
  'A2',
  'B1',
  'B1',
  'B2',
  'B2',
  'C1',
  'C1',
  'C2',
  'C2',
] as const;

export const ASSIGNMENTS: SeedAssignment[] = [
  // ───────────────────────────── Level 1 (A1) ─────────────────────────────
  {
    level: 1,
    moduleIndex: 0,
    type: 'TEXT_CONTENT',
    title: 'Introduce Yourself',
    titleAr: 'عرّف بنفسك',
    task: 'اكتب فقرة قصيرة بالإنجليزية تعرّف فيها بنفسك كما لو كنت تقابل زميلاً جديداً في الحاضنة.',
    requirements: [
      'من 6 إلى 8 جمل بسيطة.',
      'اذكر اسمك، وعمرك، ومدينتك، وما تدرسه أو تعمله.',
      "استخدم I am / I'm و My name is و I live in.",
      'اختم بجملة عن لونك المفضل أو هوايتك.',
    ],
    example: "Hello! My name is Sara. I'm 20 years old. I live in Gaza.",
    criteria: [
      ['اكتمال المعلومات المطلوبة', 40],
      ['صحة الجمل (I am / My / I live)', 40],
      ['الإملاء وعلامات الترقيم', 20],
    ],
    icon: 'hand',
  },
  {
    level: 1,
    moduleIndex: 2,
    type: 'FILE_UPLOAD',
    title: 'My Family Tree',
    titleAr: 'شجرة عائلتي',
    task: 'ارسم شجرة عائلتك على ورقة أو على الحاسوب، واكتب على كل فرد كلمته بالإنجليزية، ثم ارفع صورة أو ملفاً لها.',
    requirements: [
      'ستة أفراد على الأقل: mother, father, brother, sister, grandmother...',
      'تحت الشجرة اكتب 5 جمل مثل: This is my brother. His name is Ali.',
      'استخدم my و his و her بشكل صحيح.',
    ],
    example: 'This is my mother. Her name is Mona. She is a teacher.',
    criteria: [
      ['كلمات العائلة صحيحة', 40],
      ['الجمل الخمس وصحة his / her', 40],
      ['وضوح الشجرة وتنظيمها', 20],
    ],
    icon: 'users',
  },

  // ───────────────────────────── Level 2 (A1) ─────────────────────────────
  {
    level: 2,
    moduleIndex: 0,
    type: 'TEXT_CONTENT',
    title: 'My Daily Routine',
    titleAr: 'روتيني اليومي',
    task: 'صف يوماً عادياً في حياتك من الاستيقاظ حتى النوم.',
    requirements: [
      'من 8 إلى 10 جمل بزمن المضارع البسيط.',
      "استخدم أوقاتاً محددة: at 7 o'clock, in the morning, after lunch.",
      'استخدم ثلاث كلمات تكرار على الأقل: always, usually, sometimes, never.',
      'انتبه لإضافة s مع he / she إذا ذكرت فرداً من عائلتك.',
    ],
    example: 'I usually wake up at 6:30. Then I have breakfast with my family.',
    criteria: [
      ['المضارع البسيط وإضافة s', 40],
      ['التعابير الزمنية وكلمات التكرار', 30],
      ['ترتيب الأحداث ووضوحها', 30],
    ],
    icon: 'alarm-clock',
  },
  {
    level: 2,
    moduleIndex: 2,
    type: 'FILE_UPLOAD',
    title: 'Map of My Neighbourhood',
    titleAr: 'خريطة حيّي',
    task: 'ارسم خريطة بسيطة لحيّك أو لمكان تعرفه، وسمِّ الأماكن بالإنجليزية، ثم اكتب إرشادات للوصول من بيتك إلى مكانين.',
    requirements: [
      'خمسة أماكن على الأقل: bakery, school, mosque, pharmacy, market...',
      'إرشادان كاملان باستخدام: go straight, turn left, turn right, next to, opposite.',
      'ارفع صورة واضحة للخريطة والإرشادات (أو ملف PDF).',
    ],
    example:
      'From my house, go straight and turn left. The bakery is next to the pharmacy.',
    criteria: [
      ['أسماء الأماكن صحيحة', 30],
      ['دقة الإرشادات وحروف الجر', 50],
      ['وضوح الخريطة', 20],
    ],
    icon: 'map',
  },

  // ───────────────────────────── Level 3 (A2) ─────────────────────────────
  {
    level: 3,
    moduleIndex: 1,
    type: 'TEXT_CONTENT',
    title: 'My Last Weekend',
    titleAr: 'عطلتي الماضية',
    task: 'اكتب نصاً تحكي فيه ماذا فعلت في عطلة نهاية الأسبوع الماضية.',
    requirements: [
      'من 80 إلى 100 كلمة بزمن الماضي البسيط.',
      'خمسة أفعال منتظمة (played, visited...) وخمسة شاذة (went, ate, saw...) على الأقل.',
      'استخدم كلمات الربط: first, then, after that, finally.',
      'اختم بجملة تقول فيها هل استمتعت ولماذا.',
    ],
    example:
      'Last Friday, I visited my grandparents. First, we had lunch together...',
    criteria: [
      ['صحة أفعال الماضي المنتظمة والشاذة', 50],
      ['كلمات الربط وتسلسل الأحداث', 30],
      ['الطول والإملاء', 20],
    ],
    icon: 'calendar-days',
  },
  {
    level: 3,
    moduleIndex: 2,
    type: 'FILE_UPLOAD',
    title: 'Comparison Chart',
    titleAr: 'جدول مقارنة',
    task: 'اختر شيئين من نوع واحد (مدينتين، هاتفين، رياضتين...) وقارن بينهما في جدول، ثم اكتب جملاً بصيغ المقارنة.',
    requirements: [
      'جدول فيه خمس صفات على الأقل (price, size, speed...).',
      'ست جمل مقارنة: bigger than, more expensive than, as ... as.',
      'جملتان بصيغة التفضيل: the best, the most popular.',
      'ارفع الجدول والجمل في ملف واحد (Word أو PDF أو صورة).',
    ],
    example: 'Gaza is smaller than Cairo, but it is busier than many cities.',
    criteria: [
      ['صحة صيغ المقارنة والتفضيل', 50],
      ['اكتمال الجدول', 30],
      ['التنظيم والإملاء', 20],
    ],
    icon: 'scale',
  },

  // ───────────────────────────── Level 4 (A2) ─────────────────────────────
  {
    level: 4,
    moduleIndex: 0,
    type: 'TEXT_CONTENT',
    title: 'My Plans for Next Year',
    titleAr: 'خططي للعام القادم',
    task: 'اكتب عن خططك وتوقعاتك للعام القادم في الدراسة أو العمل أو حياتك الشخصية.',
    requirements: [
      'من 100 إلى 120 كلمة.',
      'استخدم going to للخطط المؤكدة، و will للتوقعات والقرارات.',
      "جملتان على الأقل بالمضارع المستمر لموعد محدد (I'm meeting...).",
      'اذكر سبباً لكل خطة باستخدام because أو so.',
    ],
    example:
      "Next year, I'm going to learn programming because I want to build an app.",
    criteria: [
      ['التمييز بين going to و will', 40],
      ['تنوّع الخطط والأسباب', 30],
      ['القواعد العامة والإملاء', 30],
    ],
    icon: 'rocket',
  },
  {
    level: 4,
    moduleIndex: 1,
    type: 'FILE_UPLOAD',
    title: 'Travel Poster',
    titleAr: 'ملصق رحلة',
    task: 'صمّم ملصقاً من صفحة واحدة عن مكان زرته أو تتمنى زيارته، على ورق أو على الحاسوب.',
    requirements: [
      'عنوان واسم المكان وصورة أو رسمة له.',
      'أربع جمل بالمضارع التام: I have visited..., I have never seen..., Have you ever...?',
      "ثلاث نصائح للزائر: You should... / You shouldn't...",
      'ارفع صورة أو PDF للملصق.',
    ],
    example:
      'Have you ever seen the sea in Gaza at sunset? You should walk on the beach.',
    criteria: [
      ['المضارع التام و ever / never', 40],
      ['النصائح بـ should', 30],
      ['التصميم والوضوح', 30],
    ],
    icon: 'plane',
  },

  // ───────────────────────────── Level 5 (B1) ─────────────────────────────
  {
    level: 5,
    moduleIndex: 0,
    type: 'TEXT_CONTENT',
    title: 'A Day I Will Never Forget',
    titleAr: 'يوم لن أنساه',
    task: 'اكتب قصة حقيقية أو متخيلة عن يوم مميز في حياتك.',
    requirements: [
      'من 120 إلى 150 كلمة.',
      'استخدم الماضي المستمر لوصف الخلفية والماضي البسيط للأحداث (I was walking when...).',
      'استخدم while و when و as soon as.',
      'قسّم القصة إلى بداية ووسط ونهاية.',
    ],
    example:
      'It was raining heavily. I was waiting for the bus when my phone rang...',
    criteria: [
      ['الماضي المستمر مع الماضي البسيط', 40],
      ['بناء القصة وتشويقها', 30],
      ['المفردات والربط', 30],
    ],
    icon: 'book-open',
  },
  {
    level: 5,
    moduleIndex: 2,
    type: 'FILE_UPLOAD',
    title: 'My CV in English',
    titleAr: 'سيرتي الذاتية بالإنجليزية',
    task: 'اكتب سيرة ذاتية من صفحة واحدة بالإنجليزية، يمكنك تقديمها لبرنامج تدريبي أو وظيفة.',
    requirements: [
      'الأقسام: Profile, Education, Experience, Skills, Languages.',
      'فقرة Profile من 3 جمل تستخدم أنماط الأفعال: I enjoy working..., I want to learn..., I am good at...',
      'نقاط قصيرة تبدأ بأفعال: organised, built, helped, managed.',
      'ارفع الملف بصيغة PDF أو Word.',
    ],
    example:
      'I enjoy solving problems and I want to develop my skills in web design.',
    criteria: [
      ['أنماط الأفعال (-ing و to)', 30],
      ['اكتمال الأقسام ووضوحها', 40],
      ['اللغة المهنية والتنسيق', 30],
    ],
    icon: 'file-text',
  },

  // ───────────────────────────── Level 6 (B1) ─────────────────────────────
  {
    level: 6,
    moduleIndex: 1,
    type: 'TEXT_CONTENT',
    title: 'How Olive Oil Is Made',
    titleAr: 'كيف يُصنع زيت الزيتون',
    task: 'اشرح مراحل صناعة زيت الزيتون من القطف حتى التعبئة، أو اختر منتجاً آخر تعرفه.',
    requirements: [
      'من 120 إلى 150 كلمة.',
      'ست جمل على الأقل بالمبني للمجهول: are picked, is washed, is pressed...',
      'استخدم كلمات الترتيب: first, next, after that, finally.',
      'جملة واحدة بالمجهول في زمن آخر (has been / was).',
    ],
    example:
      'First, the olives are picked by hand. Then they are taken to the press.',
    criteria: [
      ['صحة المبني للمجهول', 50],
      ['ترتيب المراحل ووضوحها', 30],
      ['المفردات والإملاء', 20],
    ],
    icon: 'factory',
  },
  {
    level: 6,
    moduleIndex: 2,
    type: 'FILE_UPLOAD',
    title: 'Phrasal Verbs Mini-Dictionary',
    titleAr: 'قاموسي للأفعال المركبة',
    task: 'أنشئ قاموساً صغيراً لعشرة أفعال مركبة (phrasal verbs) من الوحدة أو من قراءتك.',
    requirements: [
      'لكل فعل: معناه بالإنجليزية، ومعناه بالعربية، وجملة من تأليفك.',
      'ثلاث جمل على الأقل تستخدم جمل الوصل: who, which, where, that.',
      'يمكنك تنفيذه في جدول أو بطاقات مصورة.',
      'ارفع الملف (Word أو PDF أو صورة).',
    ],
    example:
      'give up — to stop trying: My friend, who loves football, never gives up.',
    criteria: [
      ['دقة المعاني', 40],
      ['جودة الجمل وجمل الوصل', 40],
      ['التنظيم', 20],
    ],
    icon: 'book-a',
  },

  // ───────────────────────────── Level 7 (B2) ─────────────────────────────
  {
    level: 7,
    moduleIndex: 0,
    type: 'TEXT_CONTENT',
    title: 'If I Could Change One Thing',
    titleAr: 'لو استطعت تغيير شيء واحد',
    task: 'اكتب مقالاً قصيراً عن شيء واحد تتمنى تغييره في مدينتك أو مجتمعك، وماذا سيحدث لو تغيّر.',
    requirements: [
      'من 150 إلى 180 كلمة.',
      'جملتان على الأقل بالشرط الثاني (If I had..., I would...).',
      'جملة بالشرط الثالث (If ... had ..., ... would have ...).',
      'استخدم I wish و If only مرة واحدة على الأقل.',
    ],
    example:
      'If our town had a public library, young people would spend their time more usefully.',
    criteria: [
      ['الشرط الثاني والثالث و wish', 50],
      ['قوة الفكرة وتنظيم المقال', 30],
      ['المفردات والدقة', 20],
    ],
    icon: 'lightbulb',
  },
  {
    level: 7,
    moduleIndex: 1,
    type: 'FILE_UPLOAD',
    title: 'Interview Report',
    titleAr: 'تقرير مقابلة',
    task: 'قابل أحد أفراد عائلتك أو أصدقائك واسأله خمسة أسئلة عن عمله أو دراسته، ثم اكتب تقريراً بالكلام المنقول.',
    requirements: [
      'الأسئلة الخمسة كما طرحتها (كلام مباشر).',
      'تقرير من 150 كلمة بالكلام المنقول: She said that..., He told me..., I asked him whether...',
      'انتبه لتغيير الأزمنة والضمائر وظروف الزمان.',
      'ارفع التقرير بصيغة Word أو PDF.',
    ],
    example:
      'My uncle told me that he had started his business ten years before.',
    criteria: [
      ['تحويل الأزمنة والضمائر', 50],
      ['أفعال النقل وتنوّعها', 30],
      ['التنظيم والإملاء', 20],
    ],
    icon: 'mic',
  },

  // ───────────────────────────── Level 8 (B2) ─────────────────────────────
  {
    level: 8,
    moduleIndex: 2,
    type: 'TEXT_CONTENT',
    title: 'Formal Email: Applying to TechBox',
    titleAr: 'بريد رسمي: التقديم إلى تك بوكس',
    task: 'اكتب بريداً إلكترونياً رسمياً تتقدم فيه لبرنامج تدريبي في حاضنة TechBox.',
    requirements: [
      'من 150 إلى 200 كلمة، مع سطر موضوع (Subject).',
      'تحية وختام رسميان: Dear Sir or Madam / Yours faithfully.',
      'عرّف بنفسك، واذكر سبب اهتمامك، ومهاراتك، وما تتوقعه من البرنامج.',
      'استخدم أدوات ربط رسمية: Furthermore, In addition, However, Therefore.',
    ],
    example:
      'Dear Sir or Madam, I am writing to apply for the Web Development programme...',
    criteria: [
      ['الأسلوب الرسمي وبنية البريد', 40],
      ['أدوات الربط ووضوح الأفكار', 30],
      ['الدقة اللغوية', 30],
    ],
    icon: 'mail',
  },
  {
    level: 8,
    moduleIndex: 0,
    type: 'FILE_UPLOAD',
    title: 'Mystery Case File',
    titleAr: 'ملف لغز',
    task: 'اكتب لغزاً قصيراً (شيء مفقود أو حدث غامض) ثم حلّله في ملف من صفحة واحدة باستخدام أفعال الاستنتاج.',
    requirements: [
      'وصف اللغز في 4 أو 5 جمل.',
      "ست استنتاجات: must have, can't have, might have, could have + past participle.",
      "جملتان للندم أو اللوم: should have / shouldn't have.",
      'جملة بالتركيب السببي: have something done أو get something done.',
      'ارفع الملف (Word أو PDF أو صورة).',
    ],
    example:
      "The window is broken. Someone must have thrown a ball. It can't have been the cat.",
    criteria: [
      ['أفعال الاستنتاج في الماضي', 50],
      ['الندم والتركيب السببي', 30],
      ['الإبداع والتنظيم', 20],
    ],
    icon: 'search',
  },

  // ───────────────────────────── Level 9 (C1) ─────────────────────────────
  {
    level: 9,
    moduleIndex: 2,
    type: 'TEXT_CONTENT',
    title: 'Summary and Response',
    titleAr: 'تلخيص ورأي',
    task: 'اقرأ مقالاً إنجليزياً عن التعليم أو التقنية (600 كلمة على الأقل)، ثم لخّصه وعلّق عليه.',
    requirements: [
      'اذكر عنوان المقال ومصدره في السطر الأول.',
      'ملخص من 120 إلى 150 كلمة بكلماتك، دون نسخ جمل من المقال.',
      'رأي من 100 كلمة تتفق فيه أو تختلف مع الكاتب، مع سبب واضح.',
      'ثلاث كلمات أكاديمية على الأقل: significant, evidence, approach, consequently.',
    ],
    example:
      'In the article "...", the author argues that online learning has significantly...',
    criteria: [
      ['دقة التلخيص وإعادة الصياغة', 40],
      ['قوة الرأي والحجة', 30],
      ['المفردات الأكاديمية', 30],
    ],
    icon: 'newspaper',
  },
  {
    level: 9,
    moduleIndex: 0,
    type: 'FILE_UPLOAD',
    title: 'Academic Vocabulary Log',
    titleAr: 'سجل المفردات الأكاديمية',
    task: 'أنشئ سجلاً لخمس عشرة كلمة أكاديمية من قراءتك، ومعها جمل للتوكيد والتقديم.',
    requirements: [
      'جدول فيه: الكلمة، نوعها، معناها، متلازمة لفظية معها، وجملة من تأليفك.',
      'خمس جمل بالتقديم أو التوكيد: Not only..., Rarely have I..., What I need is...',
      'ارفع الملف بصيغة Word أو PDF.',
    ],
    example:
      'Not only does regular reading improve vocabulary, but it also sharpens thinking.',
    criteria: [
      ['دقة المعاني والمتلازمات', 40],
      ['جمل التقديم والتوكيد', 40],
      ['التنظيم', 20],
    ],
    icon: 'library',
  },

  // ───────────────────────────── Level 10 (C1) ─────────────────────────────
  {
    level: 10,
    moduleIndex: 1,
    type: 'TEXT_CONTENT',
    title: 'Startup Elevator Pitch',
    titleAr: 'عرض مشروع ناشئ',
    task: 'اكتب عرضاً قصيراً (elevator pitch) لفكرة مشروع ناشئ تقدمه أمام لجنة مستثمرين.',
    requirements: [
      'من 150 إلى 200 كلمة.',
      'المشكلة، والحل، والفئة المستهدفة، وما يميز مشروعك، وما تطلبه.',
      'خمس متلازمات أو تعابير من لغة الأعمال: market share, gain traction, cost-effective...',
      'جملتان بجمل اسم الفاعل: Having tested..., Designed for...',
    ],
    example:
      'Designed for small shops in Gaza, our app helps owners track stock in real time...',
    criteria: [
      ['وضوح الفكرة وإقناعها', 40],
      ['لغة الأعمال والمتلازمات', 30],
      ['جمل اسم الفاعل والدقة', 30],
    ],
    icon: 'presentation',
  },
  {
    level: 10,
    moduleIndex: 2,
    type: 'FILE_UPLOAD',
    title: 'One-Page Business Proposal',
    titleAr: 'مقترح مشروع من صفحة واحدة',
    task: 'طوّر فكرة مشروعك إلى مقترح رسمي من صفحة واحدة.',
    requirements: [
      'العناوين: Background, Objectives, Proposed Solution, Budget Overview, Next Steps.',
      'من 300 إلى 400 كلمة بأسلوب أكاديمي ومهني.',
      'أدوات خطاب متنوعة: In light of..., It is worth noting that..., As a result...',
      'ارفع الملف بصيغة PDF أو Word.',
    ],
    example:
      'In light of the growing demand for remote work, we propose a shared digital...',
    criteria: [
      ['البنية والعناوين', 30],
      ['أدوات الخطاب والأسلوب', 40],
      ['الدقة والإقناع', 30],
    ],
    icon: 'briefcase',
  },

  // ───────────────────────────── Level 11 (C2) ─────────────────────────────
  {
    level: 11,
    moduleIndex: 0,
    type: 'TEXT_CONTENT',
    title: 'Formal Recommendation Memo',
    titleAr: 'مذكرة توصية رسمية',
    task: 'اكتب مذكرة رسمية إلى إدارة مؤسسة تعليمية توصي فيها بسياسة جديدة (مثل التعلم المدمج أو ساعات المكتبة).',
    requirements: [
      'من 200 إلى 250 كلمة، بالعناوين: To, From, Date, Subject.',
      'ثلاث جمل بصيغة الـ subjunctive: It is essential that every student be..., We recommend that...',
      "أسلوب رسمي موضوعي دون اختصارات (don't, it's).",
    ],
    example:
      'It is essential that every student be given access to the library after hours.',
    criteria: [
      ['صيغة الـ subjunctive', 40],
      ['الأسلوب الرسمي وبنية المذكرة', 40],
      ['قوة التوصية', 20],
    ],
    icon: 'landmark',
  },
  {
    level: 11,
    moduleIndex: 1,
    type: 'FILE_UPLOAD',
    title: 'Idioms in Context',
    titleAr: 'تعابير في سياقها',
    task: 'اجمع عشرة تعابير اصطلاحية متقدمة، واشرح كلاً منها، ثم اكتب حواراً قصيراً يستخدم خمسة منها.',
    requirements: [
      'لكل تعبير: معناه، ومتى يُستخدم (رسمي أو غير رسمي)، ومثال.',
      'حوار من 10 أسطر على الأقل بين شخصين يستخدم خمسة تعابير بشكل طبيعي.',
      'ميّز بين تعبيرين متقاربين في المعنى وفسّر الفرق بينهما.',
      'ارفع الملف بصيغة Word أو PDF.',
    ],
    example:
      "A: We're back to square one. B: Don't worry, let's not cry over spilt milk.",
    criteria: [
      ['دقة المعاني والاستخدام', 40],
      ['طبيعية الحوار', 40],
      ['التمييز بين التعابير المتقاربة', 20],
    ],
    icon: 'messages-square',
  },

  // ───────────────────────────── Level 12 (C2) ─────────────────────────────
  {
    level: 12,
    moduleIndex: 1,
    type: 'TEXT_CONTENT',
    title: 'Persuasive Speech',
    titleAr: 'خطاب إقناعي',
    task: 'اكتب خطاباً تلقيه في حفل تخرج عن دور التعليم والتقنية في بناء مستقبل غزة.',
    requirements: [
      'من 250 إلى 300 كلمة.',
      'ثلاث أدوات بلاغية على الأقل: الثلاثيات (tricolon)، والسؤال البلاغي، والتكرار، والمقابلة.',
      'جملتان بالحذف أو التقديم: Never before have we..., Some chose to leave; others, to build.',
      'نبرة ملهمة ومناسبة للجمهور.',
    ],
    example:
      'We came here with questions; we leave with purpose, with skills, and with hope.',
    criteria: [
      ['الأدوات البلاغية والتراكيب المتقدمة', 40],
      ['قوة الحجة والنبرة', 40],
      ['الدقة والأسلوب', 20],
    ],
    icon: 'megaphone',
  },
  {
    level: 12,
    moduleIndex: 2,
    type: 'FILE_UPLOAD',
    title: 'Critical Review',
    titleAr: 'مراجعة نقدية',
    task: 'اكتب مراجعة نقدية لكتاب أو مقال طويل أو فيلم وثائقي باللغة الإنجليزية.',
    requirements: [
      'من 400 إلى 500 كلمة.',
      'ملخص موجز، ثم تحليل لنقاط القوة والضعف، ثم تقييم نهائي.',
      'استشهد بعبارتين على الأقل من العمل مع ذكر الصفحة أو الدقيقة.',
      'ارفع الملف بصيغة PDF أو Word.',
    ],
    example:
      'While the author offers a compelling account of..., the argument loses force when...',
    criteria: [
      ['عمق التحليل والتقييم', 40],
      ['البنية والاستشهاد', 30],
      ['الأسلوب واللغة', 30],
    ],
    icon: 'feather',
  },
];

/** Instructions shown to the student: the task, requirements, model opening, grading and how to hand in. */
export function instructionsFor(a: SeedAssignment): string {
  const lines = [
    a.task,
    '',
    'المطلوب:',
    ...a.requirements.map((r) => `• ${r}`),
  ];
  if (a.example) lines.push('', 'مثال على البداية:', a.example);
  lines.push(
    '',
    'معايير التقييم (من 100):',
    ...a.criteria.map(([c, p]) => `• ${c}: ${p} درجة`),
  );
  lines.push(
    '',
    a.type === 'TEXT_CONTENT'
      ? 'طريقة التسليم: اكتب إجابتك في مربع النص داخل الواجب ثم اضغط «تسليم».'
      : 'طريقة التسليم: ارفع ملفاً واحداً حتى خمسة ملفات (PDF أو Word أو صور PNG / JPG / WEBP)، بحجم أقصاه 20 ميجابايت للملف.',
    'الصورة المرفقة بالواجب توضيحية فقط.',
  );
  return lines.join('\n');
}

/** Slug of the program these assignments belong to. */
export const ENGLISH_LEVELS_SLUG = 'english-levels';

/** Lesson title of an assignment, as students see it in the curriculum (also how the image upload finds it). */
export const assignmentNodeTitle = (a: SeedAssignment) =>
  `واجب: ${a.titleAr} (${a.title})`;

/** File name of the illustration in ./images. */
export function imageFileFor(a: SeedAssignment): string {
  const kind = a.type === 'TEXT_CONTENT' ? 'writing' : 'project';
  return `level-${String(a.level).padStart(2, '0')}-${kind}.png`;
}
