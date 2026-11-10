import { q, type SeedLevel } from './types.js';

export const level08: SeedLevel = {
  title: 'Level 8',
  description:
    'مستوى فوق المتوسط الثاني (CEFR B2). يستنتج الطالب باستخدام الأفعال الناقصة، ويتقن صيغ المجهول المتقدمة، ويربط أفكاره بأدوات الربط، ويكتب رسائل بريد إلكتروني رسمية.',
  modules: [
    {
      title: 'Modal Verbs: Deduction and Regret',
      titleAr: 'الأفعال الناقصة: الاستنتاج والندم',
      description:
        "الاستنتاج في الحاضر والماضي بـ must وcan't وmight، والتعبير عن الندم والنقد بـ should have وneedn't have وcould have.",
      questions: [
        q(
          'The lights are on, so someone ___ be at home.',
          'must',
          ["can't", "mustn't", "needn't"],
          'must هنا للاستنتاج شبه المؤكد بناءً على دليل وهو الأضواء المضاءة.',
        ),
        q(
          'He ___ be the thief. He was with me all evening.',
          "can't",
          ['must', 'might', 'should'],
          "can't تعبر عن استنتاج باستحالة الأمر.",
        ),
        q(
          "I'm not sure where Sara is. She ___ be at the library.",
          'might',
          ['must', "can't", 'has to'],
          "عبارة I'm not sure تدل على عدم اليقين، وmight تعبر عن الاحتمال.",
        ),
        q(
          'The ground is wet. It ___ have rained last night.',
          'must',
          ["can't", "shouldn't", "needn't"],
          'استنتاج شبه مؤكد عن الماضي: must have + التصريف الثالث.',
        ),
        q(
          "You ___ have seen Ali yesterday — he's in London this month.",
          "can't",
          ['must', 'should', 'ought to'],
          "can't have + التصريف الثالث تعبر عن استحالة وقوع الأمر في الماضي.",
        ),
        q(
          'I failed the exam. I ___ have studied harder.',
          'should',
          ['must', "can't", 'might not'],
          'should have + التصريف الثالث تعبر عن الندم على أمر لم نفعله.',
        ),
        q(
          'You ___ have brought a gift, but it was kind of you.',
          "needn't",
          ['must', "can't", "wouldn't"],
          "needn't have تعني أن الفعل حدث ولم يكن ضرورياً.",
        ),
        q(
          "I can't find my wallet. I ___ have left it at the café, but I'm not certain.",
          'may',
          ['must', "can't", 'should'],
          'may have + التصريف الثالث لاحتمال في الماضي دون تأكد.',
        ),
        q(
          'He looks so pale. He ___ be feeling well.',
          "can't",
          ['must', "needn't", 'should'],
          'الشحوب دليل على أنه ليس بخير، أي يستحيل أن يكون بصحة جيدة.',
        ),
        q(
          "Why didn't you tell me? You ___ told me earlier!",
          'could have',
          ['can have', 'may', 'would'],
          'could have + التصريف الثالث للوم شخص على ما كان بإمكانه فعله.',
        ),
      ],
    },
    {
      title: 'Advanced Passives and Causatives',
      titleAr: 'صيغ المجهول المتقدمة والتركيب السببي',
      description:
        'التراكيب الإخبارية مثل It is said that، والتركيب السببي have/get something done، والمبني للمجهول مع الأفعال الناقصة.',
      questions: [
        q(
          'It ___ that the president will resign.',
          'is said',
          ['says', 'is saying', 'said'],
          'التركيب الشائع في الأخبار: It is said that بمعنى «يقال إن».',
        ),
        q(
          'He is believed ___ the country last week.',
          'to have left',
          ['to leave', 'leaving', 'left'],
          'الحدث وقع قبل الاعتقاد الحالي، فنستخدم المصدر التام: to have + التصريف الثالث.',
        ),
        q(
          'I ___ my car repaired yesterday.',
          'had',
          ['made', 'did', 'let'],
          'التركيب السببي have + مفعول + التصريف الثالث يعني أن شخصاً آخر قام بالعمل لي.',
        ),
        q(
          'She is going to have her hair ___.',
          'cut',
          ['cutting', 'to cut', 'cuts'],
          'في التركيب السببي يأتي بعد المفعول التصريف الثالث، وهو cut من cut.',
        ),
        q(
          'We need to get the roof ___.',
          'fixed',
          ['fix', 'fixing', 'to fix'],
          'التركيب get + مفعول + التصريف الثالث مرادف غير رسمي لـ have something done.',
        ),
        q(
          'The project ___ finished by Friday.',
          'must be',
          ['must', 'must have', 'must being'],
          'المبني للمجهول مع فعل ناقص: must be + التصريف الثالث.',
        ),
        q(
          'The meeting is being ___ in the main hall.',
          'held',
          ['hold', 'holding', 'holds'],
          'التصريف الثالث من hold هو held، ويأتي بعد is being.',
        ),
        q(
          'The painting is thought ___ by Picasso.',
          'to have been painted',
          ['to paint', 'to have painted', 'painting'],
          'اللوحة تُرسم وحدث الرسم أسبق، فنستخدم to have been + التصريف الثالث.',
        ),
        q(
          'He had his wallet ___ on the train.',
          'stolen',
          ['steal', 'stole', 'stealing'],
          'يستخدم التركيب أيضاً لحدث سيئ وقع للشخص: had + مفعول + التصريف الثالث stolen.',
        ),
        q(
          'I got my brother ___ me with the homework.',
          'to help',
          ['help', 'helped', 'helps'],
          'عندما يكون المفعول هو الفاعل الحقيقي نستخدم get + شخص + to + الفعل.',
        ),
      ],
    },
    {
      title: 'Linking Ideas and Formal Emails',
      titleAr: 'ربط الأفكار والبريد الرسمي',
      description:
        'أدوات الربط للتضاد والسبب مثل although وdespite وdue to، وبنية البريد الإلكتروني الرسمي وعباراته المناسبة.',
      questions: [
        q(
          '___ the rain, we enjoyed the trip.',
          'Despite',
          ['Although', 'However', 'Even'],
          'بعد الفراغ اسم (the rain)، وDespite يليها اسم.',
        ),
        q(
          '___ it was raining, we enjoyed the trip.',
          'Although',
          ['Despite', 'However', 'In spite of'],
          'بعد الفراغ جملة كاملة، وAlthough يليها فاعل وفعل.',
        ),
        q(
          'The report was late. ___, it was excellent.',
          'However',
          ['Because', 'Although', 'Despite'],
          'However تربط جملتين منفصلتين وتأتي بعدها فاصلة.',
        ),
        q(
          'She stayed home ___ she was ill.',
          'because',
          ['because of', 'due to', 'despite'],
          'بعد الفراغ جملة كاملة، فنستخدم because.',
        ),
        q(
          'The flight was cancelled ___ the storm.',
          'due to',
          ['because', 'although', 'since'],
          'بعد الفراغ اسم، وdue to يليها اسم.',
        ),
        q(
          "What is the right opening for a formal email when you don't know the person's name?",
          'Dear Sir or Madam,',
          ['Hi there,', 'Hey!', "What's up,"],
          'Dear Sir or Madam هي التحية الرسمية عند عدم معرفة اسم المستلم.',
        ),
        q(
          'Your formal email begins "Dear Mr Hassan". What is the best closing?',
          'Yours sincerely,',
          ['Cheers,', 'See ya,', 'Love,'],
          'عند معرفة الاسم تكون الخاتمة الرسمية Yours sincerely.',
        ),
        q(
          'I am writing ___ the position of marketing manager.',
          'to apply for',
          ['for apply', 'to applying', 'apply for'],
          'نعبر عن الغرض بالمصدر مع to، والعبارة الصحيحة apply for a position.',
        ),
        q(
          'I look forward to ___ from you.',
          'hearing',
          ['hear', 'heard', 'be hear'],
          'to هنا حرف جر، فيتبعها الفعل بصيغة ing.',
        ),
        q(
          'Which sentence is most suitable for a formal email?',
          'I would appreciate it if you could inform me of your decision.',
          [
            'Tell me what you decide, OK?',
            'Just let me know.',
            'Get back to me ASAP!',
          ],
          'تناسب هذه الجملة الأسلوب الرسمي لاستخدامها I would appreciate وcould inform.',
        ),
      ],
    },
  ],
};
