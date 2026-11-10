import { q, type SeedLevel } from './types.js';

export const level06: SeedLevel = {
  title: 'Level 6',
  description:
    'المستوى المتوسط الثاني (CEFR B1). يربط الطالب الماضي بالحاضر بدقة، ويستخدم المبني للمجهول في المواقف العامة، ويبني جملاً أطول بأسماء الوصل والأفعال المركبة الشائعة.',
  modules: [
    {
      title: 'Connecting the Past to the Present',
      titleAr: 'ربط الماضي بالحاضر',
      description:
        'زمن المضارع التام المستمر والفرق بينه وبين المضارع التام البسيط، واستخدام for وsince، وأفعال الحالة.',
      questions: [
        q(
          'I ___ English for three years.',
          'have been studying',
          ['am studying', 'study', 'studying'],
          'حدث بدأ في الماضي وما زال مستمراً، فنستخدم المضارع التام المستمر مع for.',
        ),
        q(
          'She has lived here ___ 2015.',
          'since',
          ['for', 'from', 'in'],
          'نستخدم since مع نقطة بداية محددة في الزمن.',
        ),
        q(
          'He has worked here ___ ten years.',
          'for',
          ['since', 'during', 'ago'],
          'نستخدم for مع طول المدة.',
        ),
        q(
          'You look tired. What ___?',
          'have you been doing',
          ['do you do', 'you have done', 'are you do'],
          'نرى أثراً في الحاضر لنشاط استمر حتى وقت قريب، فنستخدم المضارع التام المستمر.',
        ),
        q(
          'It ___ all morning and the streets are wet.',
          'has been raining',
          ['rains', 'is rain', 'rain'],
          'نشاط متواصل له نتيجة ظاهرة الآن (الشوارع مبتلة).',
        ),
        q(
          'How long ___ you known Ali?',
          'have',
          ['are', 'do', 'did'],
          'known تصريف ثالث، فالسؤال في المضارع التام: How long have you known.',
        ),
        q(
          "I ___ three emails this morning, and it's only 10 a.m.",
          'have written',
          ['write', 'has written', 'am write'],
          'عند ذكر عدد ما أُنجز (three emails) نستخدم المضارع التام البسيط.',
        ),
        q(
          'I ___ this car since 2018.',
          'have had',
          ['have been having', 'am having', 'has'],
          'have بمعنى «يملك» فعل حالة، فلا يأتي في صيغة الاستمرار.',
        ),
        q(
          "She ___ for an hour and she still isn't finished.",
          'has been cooking',
          ['cook', 'was cook', 'have been cooking'],
          'نشاط بدأ قبل ساعة وما زال مستمراً، ومع she نستخدم has been + ing.',
        ),
        q(
          "I haven't seen him ___ a long time.",
          'for',
          ['since', 'from', 'ago'],
          'a long time تعبر عن مدة، لذلك نستخدم for.',
        ),
      ],
    },
    {
      title: 'The Passive Voice',
      titleAr: 'المبني للمجهول',
      description:
        'تكوين المبني للمجهول في الأزمنة الأساسية، ومتى نستخدمه، واستخدام by لذكر الفاعل، مع أمثلة من الصناعة والأخبار.',
      questions: [
        q(
          'English ___ all over the world.',
          'is spoken',
          ['speaks', 'is speaking', 'spoke'],
          'اللغة تُتحدث ولا تتحدث، فنستخدم المبني للمجهول: is + التصريف الثالث.',
        ),
        q(
          'This bridge ___ in 1990.',
          'was built',
          ['built', 'is build', 'has build'],
          'الجسر مفعول به ومعه وقت في الماضي: was + التصريف الثالث.',
        ),
        q(
          'The letters ___ every morning.',
          'are delivered',
          ['deliver', 'delivered', 'are delivering'],
          'الرسائل تُسلَّم، وهي جمع في المضارع: are + التصريف الثالث.',
        ),
        q(
          'The thief ___ by the police yesterday.',
          'was caught',
          ['caught', 'is catch', 'was catch'],
          'التصريف الثالث من catch هو caught، ومع yesterday نستخدم was.',
        ),
        q(
          'Change to the passive: "Someone stole my bike."',
          'My bike was stolen.',
          ['My bike stole.', 'My bike is stealing.', 'My bike has steal.'],
          'يصبح المفعول به فاعلاً، ويتحول الفعل إلى was + التصريف الثالث stolen.',
        ),
        q(
          'The new hospital ___ next year.',
          'will be built',
          ['will build', 'is built', 'builds'],
          'مبني للمجهول في المستقبل: will be + التصريف الثالث.',
        ),
        q(
          'The book was written ___ Naguib Mahfouz.',
          'by',
          ['from', 'with', 'of'],
          'نذكر من قام بالفعل في المبني للمجهول باستخدام by.',
        ),
        q(
          'Olive oil ___ from olives.',
          'is made',
          ['makes', 'is making', 'made'],
          'حقيقة عامة عن طريقة الصنع، فنستخدم is made from.',
        ),
        q(
          'Has the report ___ yet?',
          'been sent',
          ['sent', 'send', 'be sent'],
          'المبني للمجهول في المضارع التام: has been + التصريف الثالث.',
        ),
        q(
          'The room ___ at the moment.',
          'is being cleaned',
          ['is cleaning', 'has cleaning', 'cleans'],
          'المبني للمجهول في المضارع المستمر: is being + التصريف الثالث.',
        ),
      ],
    },
    {
      title: 'Relative Clauses and Phrasal Verbs',
      titleAr: 'جمل الوصل والأفعال المركبة',
      description:
        'أسماء الوصل who وwhich وwhere وwhose، والجمل الوصفية المحددة وغير المحددة، مع أكثر الأفعال المركبة استخداماً.',
      questions: [
        q(
          'The man ___ lives next door is a doctor.',
          'who',
          ['which', 'where', 'whose'],
          'نستخدم who للعاقل عندما يكون فاعلاً في جملة الوصل.',
        ),
        q(
          'This is the phone ___ I bought yesterday.',
          'which',
          ['who', 'where', 'whose'],
          'نستخدم which لغير العاقل.',
        ),
        q(
          "That's the school ___ I studied.",
          'where',
          ['which', 'who', 'whose'],
          'نستخدم where للمكان عندما يليها فاعل وفعل مكتمل.',
        ),
        q(
          "She's the woman ___ son won the prize.",
          'whose',
          ['who', 'which', 'where'],
          'whose تدل على الملكية، أي «التي ابنها».',
        ),
        q(
          'In which sentence can you leave out the relative pronoun?',
          'The book that I read was good.',
          [
            'The man who called was rude.',
            'The dog that bit me ran away.',
            'The bus that goes to town is late.',
          ],
          'يمكن حذف اسم الوصل عندما يكون مفعولاً به، كما في that I read، ولا يحذف إذا كان فاعلاً.',
        ),
        q(
          'My brother, ___ lives in Dubai, is an engineer.',
          'who',
          ['that', 'which', 'whose'],
          'لا نستخدم that في الجملة غير المحددة الموضوعة بين فاصلتين، والعاقل يأخذ who.',
        ),
        q(
          'Please ___ your shoes before you enter.',
          'take off',
          ['take on', 'put off', 'give up'],
          'take off تعني يخلع.',
        ),
        q(
          "I'm ___ my keys. Have you seen them?",
          'looking for',
          ['looking at', 'looking after', 'looking up'],
          'look for تعني يبحث عن، أما look after فتعني يعتني بـ.',
        ),
        q(
          'The meeting was ___ until next week.',
          'put off',
          ['put on', 'turned up', 'given up'],
          'put off تعني يؤجل.',
        ),
        q(
          'He ___ smoking last year.',
          'gave up',
          ['gave in', 'took up', 'looked after'],
          'give up تعني يقلع عن عادة أو يتوقف عنها.',
        ),
      ],
    },
  ],
};
