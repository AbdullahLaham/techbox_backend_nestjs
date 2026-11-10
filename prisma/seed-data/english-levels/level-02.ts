import { q, type SeedLevel } from './types.js';

export const level02: SeedLevel = {
  title: 'Level 2',
  description:
    'المستوى المبتدئ الثاني (CEFR A1). يصف الطالب روتينه اليومي بزمن المضارع البسيط، ويتعامل مع الطعام والتسوق، ويصف الأماكن في مدينته ويسأل عن الاتجاهات.',
  modules: [
    {
      title: 'Daily Routines',
      titleAr: 'الروتين اليومي',
      description:
        'زمن المضارع البسيط في الإثبات والنفي والسؤال، وظروف التكرار مثل always وnever، وحروف الجر مع الوقت.',
      questions: [
        q(
          'She ___ up at seven every day.',
          'gets',
          ['get', 'getting', 'to get'],
          'في المضارع البسيط يضاف s للفعل مع he وshe وit.',
        ),
        q(
          'My brother ___ not drink coffee.',
          'does',
          ['do', 'is', 'has'],
          'ننفي المضارع البسيط مع المفرد الغائب باستخدام does not.',
        ),
        q(
          '___ you go to work by bus?',
          'Do',
          ['Does', 'Are', 'Is'],
          'يبدأ السؤال في المضارع البسيط مع you بـ Do.',
        ),
        q(
          'He ___ football on Fridays.',
          'plays',
          ['play', 'playing', 'to play'],
          'الفاعل he مفرد غائب، فنضيف s للفعل: plays.',
        ),
        q(
          'Which sentence is correct?',
          'I always have breakfast at home.',
          [
            'I have always breakfast at home.',
            'Always I have breakfast at home.',
            'I have breakfast always at home.',
          ],
          'يأتي ظرف التكرار always قبل الفعل الأساسي have.',
        ),
        q(
          "My class starts ___ 9 o'clock.",
          'at',
          ['in', 'on', 'to'],
          'نستخدم at مع الساعات المحددة.',
        ),
        q(
          "We don't work ___ Fridays.",
          'on',
          ['in', 'at', 'by'],
          'نستخدم on مع أيام الأسبوع.',
        ),
        q(
          'What time ___ the shop open?',
          'does',
          ['do', 'is', 'are'],
          'الفاعل the shop مفرد، والفعل open فعل عادي، لذلك نستخدم does.',
        ),
        q(
          'What does "never" mean?',
          'Not at any time',
          ['Every time', 'Most of the time', 'Two times only'],
          'never تعني «أبداً»، أي عدم حدوث الفعل في أي وقت.',
        ),
        q(
          'She ___ to school because it is near her house.',
          'walks',
          ['walk', 'walking', 'to walk'],
          'مع she نضيف s إلى الفعل في المضارع البسيط: walks.',
        ),
      ],
    },
    {
      title: 'Food and Shopping',
      titleAr: 'الطعام والتسوق',
      description:
        'الأسماء المعدودة وغير المعدودة، واستخدام some وany وhow much وhow many، والعبارات الأساسية للطلب والشراء.',
      questions: [
        q(
          'There is ___ milk in the fridge.',
          'some',
          ['a', 'an', 'many'],
          'milk اسم غير معدود، ونستخدم معه some في الجملة المثبتة.',
        ),
        q(
          'Are there ___ eggs?',
          'any',
          ['much', 'a', 'an'],
          'نستخدم any في السؤال مع الجمع المعدود.',
        ),
        q(
          'How ___ water do you drink every day?',
          'much',
          ['many', 'long', 'old'],
          'water غير معدود، فنسأل عن كميته بـ How much.',
        ),
        q(
          'How ___ apples do you want?',
          'many',
          ['much', 'long', 'old'],
          'apples جمع معدود، فنسأل عن عدده بـ How many.',
        ),
        q(
          'Which word is uncountable?',
          'rice',
          ['banana', 'egg', 'sandwich'],
          'الأرز rice لا يعد بالقطعة، لذلك فهو اسم غير معدود.',
        ),
        q(
          "How much ___ this shirt? — It's 20 dollars.",
          'is',
          ['are', 'do', 'does'],
          'shirt مفرد، فنقول How much is عند السؤال عن السعر.',
        ),
        q(
          'Can I ___ a cup of tea, please?',
          'have',
          ['has', 'having', 'had'],
          'يأتي الفعل بعد can في صورته الأساسية دون تغيير.',
        ),
        q(
          'Choose the correct phrase: a ___ of bread.',
          'loaf',
          ['bottle', 'glass', 'can'],
          'نقول a loaf of bread بمعنى رغيف خبز.',
        ),
        q(
          "We don't have ___ sugar. Please buy some.",
          'any',
          ['some', 'a', 'many'],
          'نستخدم any في الجملة المنفية.',
        ),
        q(
          'Where do you pay in a supermarket?',
          'At the cash desk',
          ['In the kitchen', 'On the shelf', 'In the car park'],
          'الدفع يكون عند صندوق المحاسبة cash desk.',
        ),
      ],
    },
    {
      title: 'Places in Town',
      titleAr: 'الأماكن في المدينة',
      description:
        'وصف المدينة باستخدام there is وthere are، وأسماء الأماكن العامة، وحروف الجر الدالة على المكان، والسؤال عن الاتجاهات.',
      questions: [
        q(
          'There ___ a bank near my house.',
          'is',
          ['are', 'am', 'be'],
          'نستخدم there is مع الاسم المفرد.',
        ),
        q(
          'There ___ three parks in our city.',
          'are',
          ['is', 'am', 'be'],
          'نستخدم there are مع الاسم الجمع.',
        ),
        q(
          'The book is ___ the table, not under it.',
          'on',
          ['to', 'from', 'between'],
          'on تعني «على» وتدل على وجود الشيء فوق سطح.',
        ),
        q(
          'You go to a ___ to buy medicine.',
          'pharmacy',
          ['library', 'bakery', 'stadium'],
          'الصيدلية pharmacy هي مكان شراء الدواء.',
        ),
        q(
          'You borrow books from a ___.',
          'library',
          ['hospital', 'restaurant', 'bank'],
          'نستعير الكتب من المكتبة library.',
        ),
        q(
          'Go ___ ahead, then turn left.',
          'straight',
          ['long', 'front', 'near'],
          'تعني Go straight ahead «امش إلى الأمام مباشرة».',
        ),
        q(
          'The bank is ___ the hospital and the school.',
          'between',
          ['next', 'on', 'in'],
          'between تعني «بين» وتستخدم بين شيئين مع and.',
        ),
        q(
          'Is there a café near here? — Yes, ___.',
          'there is',
          ['there are', 'there has', 'it have'],
          'نجيب عن السؤال Is there باختصار: Yes, there is.',
        ),
        q(
          'The pharmacy is next ___ the bakery.',
          'to',
          ['of', 'at', 'from'],
          'التعبير الصحيح next to ويعني «بجانب».',
        ),
        q(
          "Excuse me, ___ is the nearest bus station? — It's on King Street.",
          'where',
          ['who', 'when', 'why'],
          'الجواب يحدد مكاناً، لذلك نسأل بكلمة where.',
        ),
      ],
    },
  ],
};
