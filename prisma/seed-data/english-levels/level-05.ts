import { q, type SeedLevel } from './types.js';

export const level05: SeedLevel = {
  title: 'Level 5',
  description:
    'المستوى المتوسط الأول (CEFR B1). يروي الطالب قصصاً وأحداثاً ماضية بتفاصيلها، ويتحدث عن الاحتمالات الواقعية، ويستخدم مفردات العمل والدراسة وصيغ الفعل بعد الأفعال الأخرى.',
  modules: [
    {
      title: 'Telling Stories About the Past',
      titleAr: 'رواية أحداث الماضي',
      description:
        'الماضي المستمر مع الماضي البسيط، واستخدام when وwhile وduring، والتعبير عن العادات السابقة بـ used to.',
      questions: [
        q(
          'I ___ dinner when the phone rang.',
          'was having',
          ['have', 'am having', 'has had'],
          'حدث طويل كان جارياً (الماضي المستمر) قاطعه حدث قصير (الماضي البسيط).',
        ),
        q(
          'While she ___, she cut her finger.',
          'was cooking',
          ['cooks', 'is cooking', 'has cooked'],
          'بعد while نستخدم عادةً الماضي المستمر للحدث الذي كان جارياً.',
        ),
        q(
          'It ___ when we left the house.',
          'was raining',
          ['rains', 'is raining', 'has rained'],
          'الماضي المستمر يصف الخلفية التي كانت قائمة لحظة وقوع حدث آخر.',
        ),
        q(
          'What ___ you doing at 8 p.m. last night?',
          'were',
          ['did', 'are', 'have'],
          'السؤال عن حدث كان جارياً في وقت محدد من الماضي: were + فعل ing.',
        ),
        q(
          "I ___ play tennis, but now I don't.",
          'used to',
          ['use to', 'am used to', 'was use to'],
          'used to + الفعل يعبر عن عادة في الماضي انتهت الآن.',
        ),
        q(
          'Did you ___ live in Amman?',
          'use to',
          ['used to', 'using to', 'uses to'],
          'بعد did تعود used to إلى use to لأن did تحمل علامة الماضي.',
        ),
        q(
          'My father ___ not use to drive a car.',
          'did',
          ['was', 'had', 'were'],
          'نفي used to يكون باستخدام did not use to.',
        ),
        q(
          'Suddenly, the lights ___ out.',
          'went',
          ['go', 'are going', 'goes'],
          'كلمة Suddenly تدل على حدث قصير مفاجئ في الماضي، فنستخدم الماضي البسيط.',
        ),
        q(
          'We were walking home ___ it started to snow.',
          'when',
          ['while', 'during', 'for'],
          'when تربط الحدث الجاري بالحدث القصير الذي قطعه، ويأتي بعدها الماضي البسيط.',
        ),
        q(
          '___ the film, my phone rang.',
          'During',
          ['While', 'When', 'For'],
          'بعد الفراغ اسم (the film) وليس جملة، لذلك نستخدم During.',
        ),
      ],
    },
    {
      title: 'Real Conditions and Possibilities',
      titleAr: 'الشروط والاحتمالات الواقعية',
      description:
        'الجملة الشرطية الصفرية والأولى، وجمل الوقت بعد when وas soon as، واستخدام unless وin case.',
      questions: [
        q(
          'If you heat ice, it ___.',
          'melts',
          ['melted', 'melting', 'has melted'],
          'حقيقة علمية عامة، فنستخدم الشرط الصفري: مضارع بسيط في الجزأين.',
        ),
        q(
          'If it rains tomorrow, we ___ at home.',
          'will stay',
          ['stayed', 'staying', 'had stayed'],
          'الشرط الأول لاحتمال واقعي في المستقبل: If + مضارع، ثم will + الفعل.',
        ),
        q(
          'If you ___ hard, you will pass the exam.',
          'study',
          ['will study', 'studied', 'studying'],
          'لا نستخدم will بعد if في الشرط الأول، بل المضارع البسيط.',
        ),
        q(
          'I will call you when I ___ home.',
          'get',
          ['will get', 'got', 'getting'],
          'بعد when في جمل الوقت عن المستقبل نستخدم المضارع البسيط.',
        ),
        q(
          "You won't get a good job ___ you learn English.",
          'unless',
          ['if', 'when', 'as'],
          'unless تعني «إلا إذا» وهي مناسبة لمعنى الجملة.',
        ),
        q(
          'As soon as she ___, we will start.',
          'arrives',
          ['will arrive', 'arrived', 'arriving'],
          'بعد as soon as نستخدم المضارع البسيط رغم أن المعنى للمستقبل.',
        ),
        q(
          'What ___ you do if you miss the bus?',
          'will',
          ['are', 'did', 'has'],
          'السؤال عن نتيجة محتملة في المستقبل، فنستخدم will مع الفعل الأساسي do.',
        ),
        q(
          'Water boils if you ___ it to 100°C.',
          'heat',
          ['will heat', 'heated', 'heating'],
          'الشرط الصفري يستخدم المضارع البسيط في جزأيه.',
        ),
        q(
          'Take an umbrella ___ it rains.',
          'in case',
          ['unless', 'so', 'but'],
          'in case تعني «تحسباً لـ»؛ نأخذ المظلة تحسباً لنزول المطر.',
        ),
        q(
          'Unless you hurry, you ___ the train.',
          'will miss',
          ['missed', 'have missed', 'had missed'],
          'تعمل unless مثل if في الشرط الأول، فتكون النتيجة will + الفعل.',
        ),
      ],
    },
    {
      title: 'Work, Study and Verb Patterns',
      titleAr: 'العمل والدراسة وأنماط الأفعال',
      description:
        'صيغة ing والمصدر مع to بعد الأفعال والحروف، مع مفردات أساسية عن التوظيف والدراسة.',
      questions: [
        q(
          'I enjoy ___ with my colleagues.',
          'working',
          ['to work', 'work', 'worked'],
          'الفعل enjoy يتبعه الفعل بصيغة ing.',
        ),
        q(
          'She decided ___ a new job.',
          'to look for',
          ['looking for', 'look for', 'looked for'],
          'الفعل decide يتبعه المصدر مع to.',
        ),
        q(
          "He's good at ___ problems.",
          'solving',
          ['solve', 'to solve', 'solved'],
          'بعد حرف الجر at يأتي الفعل بصيغة ing.',
        ),
        q(
          'We hope ___ the project by June.',
          'to finish',
          ['finishing', 'finish', 'finished'],
          'الفعل hope يتبعه المصدر مع to.',
        ),
        q(
          'Would you mind ___ the door?',
          'opening',
          ['to open', 'open', 'opened'],
          'التعبير Would you mind يتبعه الفعل بصيغة ing.',
        ),
        q(
          '___ a foreign language takes time.',
          'Learning',
          ['Learn', 'Learned', 'Learns'],
          'يكون الفعل بصيغة ing عندما يقع في موقع الفاعل في الجملة.',
        ),
        q(
          'A ___ is a document that lists your education and work experience.',
          'CV',
          ['contract', 'salary', 'interview'],
          'CV هي السيرة الذاتية.',
        ),
        q(
          'The money you receive every month for your job is your ___.',
          'salary',
          ['tip', 'fare', 'fine'],
          'salary هو الراتب الشهري، أما fare فهي أجرة المواصلات وfine هي الغرامة.',
        ),
        q(
          'She applied ___ the job last week.',
          'for',
          ['to', 'at', 'on'],
          'نقول apply for a job بمعنى يتقدم لوظيفة.',
        ),
        q(
          "I'm looking forward to ___ you.",
          'meeting',
          ['meet', 'met', 'be meet'],
          'كلمة to هنا حرف جر وليست جزءاً من المصدر، لذلك يأتي بعدها الفعل بصيغة ing.',
        ),
      ],
    },
  ],
};
