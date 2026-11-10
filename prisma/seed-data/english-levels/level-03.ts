import { q, type SeedLevel } from './types.js';

export const level03: SeedLevel = {
  title: 'Level 3',
  description:
    'مستوى ما قبل المتوسط الأول (CEFR A2). يصف الطالب ما يحدث الآن، ويروي أحداثاً ماضية بسيطة، ويتحدث عن قدراته، ويقارن بين الأشخاص والأشياء.',
  modules: [
    {
      title: 'What Is Happening Now',
      titleAr: 'ما يحدث الآن',
      description:
        'زمن المضارع المستمر والفرق بينه وبين المضارع البسيط، والأفعال التي لا تأتي عادةً في الاستمرار، مع مفردات الملابس والطقس.',
      questions: [
        q(
          'Look! It ___ outside.',
          'is raining',
          ['rains', 'rain', 'raining'],
          'كلمة Look تدل على أن الحدث يقع الآن، فنستخدم المضارع المستمر: is + فعل ing.',
        ),
        q(
          'They ___ dinner at the moment.',
          'are having',
          ['have', 'has', 'having'],
          'at the moment تعني «في هذه اللحظة»، ومع they نستخدم are + ing.',
        ),
        q(
          "I ___ my homework now, so I can't talk.",
          'am doing',
          ['do', 'does', 'doing'],
          'الحدث جارٍ الآن، ومع I نستخدم am + ing.',
        ),
        q(
          'What ___ you doing?',
          'are',
          ['do', 'is', 'does'],
          'وجود doing يعني أنه مضارع مستمر، ومع you نستخدم are.',
        ),
        q(
          'She usually drinks tea, but today she ___ juice.',
          'is drinking',
          ['drinks', 'drink', 'drinking'],
          'usually للعادة، أما today هنا فتدل على موقف مؤقت يحدث الآن، فنستخدم المضارع المستمر.',
        ),
        q(
          'I ___ this word. What does it mean?',
          "don't understand",
          ['am not understanding', 'not understand', "doesn't understand"],
          'الفعل understand من أفعال الحالة، ولا يأتي عادةً في صيغة الاستمرار.',
        ),
        q(
          'You wear ___ on your hands when it is cold.',
          'gloves',
          ['boots', 'socks', 'hats'],
          'gloves هي القفازات وتلبس في اليدين.',
        ),
        q(
          "It's hot and there are no clouds. It's ___.",
          'sunny',
          ['snowy', 'cloudy', 'foggy'],
          'sunny تعني مشمساً، وهو ما يناسب طقساً حاراً بلا غيوم.',
        ),
        q(
          'What is the -ing form of "swim"?',
          'swimming',
          ['swiming', 'swimeing', 'swimmming'],
          'الفعل المكون من مقطع واحد وينتهي بساكن بعد متحرك واحد يضاعف آخره: swim ← swimming.',
        ),
        q(
          'What is the -ing form of "make"?',
          'making',
          ['makeing', 'makking', 'makes'],
          'الفعل المنتهي بحرف e صامت تحذف منه e قبل إضافة ing.',
        ),
      ],
    },
    {
      title: 'Talking About the Past',
      titleAr: 'الحديث عن الماضي',
      description:
        'زمن الماضي البسيط مع الأفعال المنتظمة والشاذة، والنفي والسؤال بـ did، والفعل was/were، لرواية أحداث من الحياة اليومية.',
      questions: [
        q(
          'We ___ to Aqaba last summer.',
          'went',
          ['go', 'goes', 'gone'],
          'last summer تدل على الماضي، وماضي go الشاذ هو went.',
        ),
        q(
          'She ___ a letter yesterday.',
          'wrote',
          ['write', 'writes', 'written'],
          'ماضي write هو wrote، أما written فهو التصريف الثالث.',
        ),
        q(
          'Did you ___ the film last night?',
          'watch',
          ['watched', 'watching', 'watches'],
          'بعد did يأتي الفعل في صورته الأساسية، لأن did تحمل علامة الماضي.',
        ),
        q(
          'I ___ see Ali yesterday.',
          "didn't",
          ["don't", "doesn't", "wasn't"],
          'ننفي الفعل العادي في الماضي بـ did not.',
        ),
        q(
          'They ___ at home last night.',
          'were',
          ['was', 'are', 'be'],
          'ماضي to be مع they هو were.',
        ),
        q(
          'He ___ tired after work yesterday.',
          'was',
          ['were', 'is', 'be'],
          'ماضي to be مع he هو was.',
        ),
        q(
          'What is the past form of "study"?',
          'studied',
          ['studyed', 'studid', 'studies'],
          'الفعل المنتهي بساكن ثم y تتحول فيه y إلى i ثم نضيف ed.',
        ),
        q(
          '___ you go to the market last Monday?',
          'Did',
          ['Do', 'Does', 'Were'],
          'last Monday تدل على الماضي، ويبدأ السؤال مع الفعل go بـ Did.',
        ),
        q(
          'I ___ my keys two days ago.',
          'lost',
          ['lose', 'loses', 'losed'],
          'ago تدل على الماضي، وماضي lose الشاذ هو lost.',
        ),
        q(
          'When ___ your grandfather born?',
          'was',
          ['were', 'did', 'does'],
          'التعبير الصحيح to be born، والفاعل مفرد في الماضي، فنقول was born.',
        ),
      ],
    },
    {
      title: 'Abilities and Comparisons',
      titleAr: 'القدرات والمقارنات',
      description:
        'التعبير عن القدرة بـ can وcould، والمقارنة بصيغتي التفضيل (comparative وsuperlative)، والتعبير as ... as.',
      questions: [
        q(
          'Birds ___ fly.',
          'can',
          ['cans', 'are can', 'can to'],
          'can لا تتغير مع الفاعل ولا يأتي بعدها to.',
        ),
        q(
          "When I was five, I ___ swim, but now I can't.",
          'could',
          ['can', 'am', 'do'],
          'could هي ماضي can وتعبر عن قدرة في الماضي.',
        ),
        q(
          'My car is ___ than yours.',
          'faster',
          ['fast', 'more fast', 'fastest'],
          'الصفة القصيرة نقارن بها بإضافة er ثم than.',
        ),
        q(
          'This book is ___ than that one.',
          'more interesting',
          ['interestinger', 'most interesting', 'interesting'],
          'الصفة الطويلة نقارن بها باستخدام more قبلها.',
        ),
        q(
          'Everest is the ___ mountain in the world.',
          'highest',
          ['higher', 'high', 'most high'],
          'بعد the وعند الحديث عن الأعلى في المجموعة نستخدم صيغة التفضيل العليا: highest.',
        ),
        q(
          'Ali is ___ at maths than his brother.',
          'better',
          ['good', 'best', 'gooder'],
          'صيغة المقارنة الشاذة من good هي better.',
        ),
        q(
          'It was terrible — the ___ day of my life.',
          'worst',
          ['bad', 'worse', 'baddest'],
          'صيغة التفضيل العليا الشاذة من bad هي worst.',
        ),
        q(
          'Sara is as ___ as her sister.',
          'tall',
          ['taller', 'tallest', 'more tall'],
          'في التركيب as ... as تبقى الصفة في صورتها الأصلية.',
        ),
        q(
          'What is the comparative form of "happy"?',
          'happier',
          ['happyer', 'happiest', 'happily'],
          'في الصفة المنتهية بساكن ثم y تتحول y إلى i ثم نضيف er.',
        ),
        q(
          "___ you speak French? — No, I can't.",
          'Can',
          ['Are', 'Did', 'Have'],
          "الجواب بـ can't يدل على أن السؤال بدأ بـ Can.",
        ),
      ],
    },
  ],
};
