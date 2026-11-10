import { q, type SeedLevel } from './types.js';

export const level01: SeedLevel = {
  title: 'Level 1',
  description:
    'المستوى المبتدئ الأول (CEFR A1). يتعلم الطالب التحية والتعريف بنفسه، والأرقام والألوان والأشياء اليومية، والحديث عن عائلته وممتلكاته باستخدام أبسط تراكيب اللغة.',
  modules: [
    {
      title: 'Greetings and Introductions',
      titleAr: 'التحية والتعارف',
      description:
        'التحية والوداع، وتقديم النفس والسؤال عن الآخرين، باستخدام الفعل to be والضمائر الشخصية وصفات الملكية الأساسية.',
      questions: [
        q(
          '___ name is Sara.',
          'My',
          ['I', 'Me', 'Mine'],
          'نستخدم صفة الملكية My قبل الاسم name بمعنى «اسمي».',
        ),
        q(
          'She ___ from Egypt.',
          'is',
          ['am', 'are', 'be'],
          'مع الضمائر he وshe وit نستخدم is.',
        ),
        q(
          'Good morning! How ___ you?',
          'are',
          ['is', 'am', 'be'],
          'مع الضمير you نستخدم are دائماً.',
        ),
        q(
          'I ___ a student.',
          'am',
          ['is', 'are', 'be'],
          'الضمير I يأتي معه الفعل am فقط.',
        ),
        q(
          'Someone says: "Nice to meet you." What is the best reply?',
          'Nice to meet you too.',
          [
            "I'm twenty years old.",
            'Goodbye, see you tomorrow.',
            'My pen is blue.',
          ],
          'الرد المناسب على عبارة التعارف هو تكرارها مع too بمعنى «وأنا أيضاً».',
        ),
        q(
          'They ___ my friends.',
          'are',
          ['is', 'am', 'be'],
          'مع الضمير they (الجمع) نستخدم are.',
        ),
        q(
          "___ are you from? — I'm from Jordan.",
          'Where',
          ['What', 'Who', 'When'],
          'نسأل عن المكان بكلمة Where، والجواب هنا اسم بلد.',
        ),
        q(
          'What is the short form of "I am"?',
          "I'm",
          ["Im'", "I'am", 'Iam'],
          "تختصر I am إلى I'm بوضع الفاصلة العلوية مكان الحرف المحذوف a.",
        ),
        q(
          'Which word do you say when you leave someone?',
          'Goodbye',
          ['Hello', 'Please', 'Good morning'],
          'كلمة Goodbye تعني «مع السلامة» وتقال عند المغادرة، أما Hello وGood morning فللتحية عند اللقاء.',
        ),
        q(
          'He ___ not a teacher. He is a doctor.',
          'is',
          ['am', 'are', 'do'],
          'نفي الفعل to be يكون بإضافة not بعده: he is not.',
        ),
      ],
    },
    {
      title: 'Numbers, Colours and Everyday Objects',
      titleAr: 'الأرقام والألوان والأشياء اليومية',
      description:
        'الأعداد، وأسماء الألوان والأشياء من حولنا، وأداتا النكرة a وan، وجمع الأسماء، وأسماء الإشارة this وthat وthese وthose.',
      questions: [
        q(
          'This is ___ apple.',
          'an',
          ['a', 'these', 'those'],
          'نستخدم an قبل الكلمة التي تبدأ بصوت متحرك مثل apple.',
        ),
        q(
          'What is 7 + 5?',
          'twelve',
          ['eleven', 'thirteen', 'twenty'],
          'سبعة زائد خمسة يساوي اثني عشر، وتكتب twelve.',
        ),
        q(
          'What is the plural of "box"?',
          'boxes',
          ['boxs', 'boxies', 'boxen'],
          'الأسماء المنتهية بالحرف x تجمع بإضافة es.',
        ),
        q(
          'What is the plural of "child"?',
          'children',
          ['childs', 'childes', 'childrens'],
          'child اسم شاذ في الجمع، وجمعه children دون إضافة s.',
        ),
        q(
          '___ is my pen, here in my hand.',
          'This',
          ['These', 'Those', 'They'],
          'نستخدم This للمفرد القريب؛ فالقلم مفرد وفي يدي.',
        ),
        q(
          '___ are my books, over there on the table.',
          'Those',
          ['This', 'That', 'It'],
          'نستخدم Those للجمع البعيد؛ فالكتب جمع وهي هناك (over there).',
        ),
        q(
          'The sky on a clear day is ___.',
          'blue',
          ['red', 'black', 'green'],
          'لون السماء الصافية أزرق، أي blue.',
        ),
        q(
          "It's raining. Take ___ umbrella.",
          'an',
          ['a', 'two', 'these'],
          'تبدأ umbrella بصوت متحرك، لذلك نستخدم an.',
        ),
        q(
          'Which number is "forty"?',
          '40',
          ['14', '4', '400'],
          'forty تعني أربعين، أما 14 فهي fourteen.',
        ),
        q(
          "What colour ___ your bag? — It's black.",
          'is',
          ['are', 'am', 'do'],
          'كلمة bag مفردة، لذلك نستخدم is في السؤال.',
        ),
      ],
    },
    {
      title: 'Family and Possessions',
      titleAr: 'العائلة والممتلكات',
      description:
        "أفراد العائلة، والحديث عما نملكه باستخدام have وhas، وصفات الملكية، وملكية الأسماء باستخدام 's.",
      questions: [
        q(
          "My father's sister is my ___.",
          'aunt',
          ['uncle', 'cousin', 'niece'],
          'أخت الأب هي العمة، وتسمى aunt، وهي نفس الكلمة المستخدمة للخالة.',
        ),
        q(
          'What does "Ali\'s book" mean?',
          'The book that belongs to Ali',
          ['Ali is a book', 'Many books for Ali', 'Ali wants to buy a book'],
          "تدل 's بعد الاسم على الملكية، فالمعنى «كتاب علي».",
        ),
        q(
          'She has a brother. ___ name is Omar.',
          'His',
          ['Her', 'He', 'She'],
          'الاسم يعود على الأخ وهو مذكر، لذلك نستخدم His وليس Her.',
        ),
        q(
          'I ___ two sisters.',
          'have',
          ['has', 'am', 'having'],
          'مع I وyou وwe وthey نستخدم have.',
        ),
        q(
          'He ___ a new phone.',
          'has',
          ['have', 'is', 'are'],
          'مع he وshe وit نستخدم has.',
        ),
        q(
          'We live in this house. It is ___ house.',
          'our',
          ['we', 'us', 'their'],
          'صفة الملكية الخاصة بالضمير we هي our وتأتي قبل الاسم.',
        ),
        q(
          'My parents are my mother and my ___.',
          'father',
          ['son', 'sister', 'daughter'],
          'كلمة parents تعني الوالدين: الأم mother والأب father.',
        ),
        q(
          '___ you have any children? — Yes, I have one son.',
          'Do',
          ['Does', 'Are', 'Is'],
          'نسأل عن الفعل have مع you باستخدام Do.',
        ),
        q(
          'Mona and Hana are sisters. ___ mother is a nurse.',
          'Their',
          ['They', 'Her', 'Theirs'],
          'الحديث عن شخصين، وصفة الملكية للجمع قبل الاسم هي Their.',
        ),
        q(
          'The son of my brother is my ___.',
          'nephew',
          ['niece', 'uncle', 'grandfather'],
          'ابن الأخ أو الأخت هو nephew، أما البنت فهي niece.',
        ),
      ],
    },
  ],
};
