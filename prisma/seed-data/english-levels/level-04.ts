import { q, type SeedLevel } from './types.js';

export const level04: SeedLevel = {
  title: 'Level 4',
  description:
    'مستوى ما قبل المتوسط الثاني (CEFR A2). يتحدث الطالب عن خططه المستقبلية وتجاربه السابقة وأسفاره، ويقدم النصائح ويعبر عن الالتزام في مواقف صحية ويومية.',
  modules: [
    {
      title: 'Future Plans',
      titleAr: 'الخطط المستقبلية',
      description:
        'التعبير عن المستقبل بـ going to وwill والمضارع المستمر، والتفريق بين الخطة المسبقة والقرار اللحظي والتوقع.',
      questions: [
        q(
          'Look at those dark clouds! It ___ rain.',
          'is going to',
          ['goes to', 'going to', 'is go to'],
          'نستخدم be going to للتوقع المبني على دليل نراه الآن، وهو الغيوم.',
        ),
        q(
          "This bag is too heavy for me. — Don't worry, I___ help you.",
          "'ll",
          ["'m", "'ve", "'d been"],
          "نستخدم will (مختصرة 'll) للقرار الذي نتخذه لحظة الكلام.",
        ),
        q(
          "We ___ visit our grandparents next weekend. We've already bought the tickets.",
          'are going to',
          ['going to', 'goes to', 'did'],
          'الخطة مقررة مسبقاً، فنستخدم be going to مع الفعل المساعد are.',
        ),
        q(
          "I ___ my dentist at 4 p.m. tomorrow. It's in my diary.",
          'am meeting',
          ['met', 'meeting', 'have met'],
          'نستخدم المضارع المستمر لموعد مرتب في المستقبل.',
        ),
        q(
          'I think Brazil ___ win the next World Cup.',
          'will',
          ['is', 'are', 'does'],
          'بعد I think نستخدم will للتعبير عن رأي أو توقع عن المستقبل.',
        ),
        q(
          'She ___ come tomorrow — she is busy.',
          "won't",
          ["willn't", "doesn't will", 'not will'],
          "نفي will هو will not ويختصر إلى won't.",
        ),
        q(
          '___ you be at home tonight?',
          'Will',
          ['Do', 'Are', 'Did'],
          'بعد الفراغ يأتي الفعل be في صورته الأساسية، وهذا يتطلب Will.',
        ),
        q(
          'What ___ you going to do after class?',
          'are',
          ['do', 'will', 'did'],
          'تركيب going to يحتاج إلى فعل to be، ومع you نستخدم are.',
        ),
        q(
          'Next year, I ___ 20 years old.',
          'will be',
          ['am being', 'being', 'was'],
          'حقيقة عن المستقبل، فنستخدم will be.',
        ),
        q(
          'Which time expression refers to the future?',
          'next month',
          ['last month', 'yesterday', 'a month ago'],
          'next month تعني الشهر القادم، أما البقية فتدل على الماضي.',
        ),
      ],
    },
    {
      title: 'Experiences and Travel',
      titleAr: 'التجارب والسفر',
      description:
        'زمن المضارع التام للحديث عن التجارب، واستخدام ever وnever وjust وyet وalready، والفرق بينه وبين الماضي البسيط، مع مفردات السفر.',
      questions: [
        q(
          'Have you ever ___ to Turkey?',
          'been',
          ['be', 'was', 'went'],
          'بعد have يأتي التصريف الثالث، والتعبير الشائع عن زيارة مكان هو been to.',
        ),
        q(
          'I have never ___ sushi.',
          'eaten',
          ['ate', 'eat', 'eating'],
          'التصريف الثالث من eat هو eaten.',
        ),
        q(
          'She has ___ finished her homework. She did it a minute ago.',
          'just',
          ['yet', 'ever', 'since'],
          'just تدل على أن الحدث وقع قبل لحظات.',
        ),
        q(
          "I haven't finished my project ___.",
          'yet',
          ['just', 'already', 'ever'],
          'yet تأتي في آخر الجملة المنفية بمعنى «حتى الآن».',
        ),
        q(
          'I ___ this film three times.',
          'have seen',
          ['have saw', 'has seen', 'am see'],
          'المضارع التام مع I هو have + التصريف الثالث seen.',
        ),
        q(
          'We ___ in Paris in 2019.',
          'were',
          ['have been', 'has been', 'are'],
          'وجود وقت محدد في الماضي (2019) يتطلب الماضي البسيط لا المضارع التام.',
        ),
        q(
          'You must show your ___ at the border.',
          'passport',
          ['pillow', 'receipt', 'menu'],
          'جواز السفر passport هو الوثيقة التي تُبرز عند الحدود.',
        ),
        q(
          'A ___ is a large bag for carrying clothes when you travel.',
          'suitcase',
          ['wallet', 'passport', 'gate'],
          'suitcase هي حقيبة السفر.',
        ),
        q(
          'He ___ already left.',
          'has',
          ['have', 'is', 'did'],
          'التصريف الثالث left مع already يدل على المضارع التام، ومع he نستخدم has.',
        ),
        q(
          'When a plane leaves the ground, it ___ off.',
          'takes',
          ['makes', 'puts', 'does'],
          'take off فعل مركب يعني إقلاع الطائرة.',
        ),
      ],
    },
    {
      title: 'Advice, Rules and Health',
      titleAr: 'النصائح والقواعد والصحة',
      description:
        "تقديم النصيحة بـ should، والتعبير عن الالتزام والمنع والجواز بـ must وhave to وmustn't وdon't have to، مع مفردات الصحة وزيارة الطبيب.",
      questions: [
        q(
          'You have a bad cough. You ___ see a doctor.',
          'should',
          ["shouldn't", "mustn't", "don't have to"],
          'should تستخدم لتقديم النصيحة، وزيارة الطبيب نصيحة مناسبة هنا.',
        ),
        q(
          "You ___ smoke in the hospital. It's forbidden.",
          "mustn't",
          ["don't have to", "needn't", 'can'],
          "mustn't تعني المنع، أما don't have to فتعني عدم الضرورة.",
        ),
        q(
          'Tomorrow is a holiday, so I ___ get up early.',
          "don't have to",
          ["mustn't", 'have to', 'must'],
          "don't have to تعني «ليس عليّ»؛ فالاستيقاظ المبكر غير ضروري لكنه ليس ممنوعاً.",
        ),
        q(
          "She ___ wear a uniform at work. It's a company rule.",
          'has to',
          ['have to', 'must to', 'has'],
          'مع she نقول has to للتعبير عن التزام تفرضه جهة خارجية.',
        ),
        q(
          'You should ___ more water.',
          'drink',
          ['to drink', 'drinking', 'drinks'],
          'بعد should يأتي الفعل في صورته الأساسية دون to.',
        ),
        q(
          'We ___ wait for an hour at the clinic yesterday.',
          'had to',
          ['must', 'have to', 'should'],
          'ماضي must وhave to في معنى الالتزام هو had to.',
        ),
        q(
          'My head hurts. I have a ___.',
          'headache',
          ['toothache', 'backache', 'stomachache'],
          'headache هو الصداع أي ألم الرأس.',
        ),
        q(
          'A doctor writes a ___ so that you can get medicine.',
          'prescription',
          ['receipt', 'recipe', 'ticket'],
          'prescription هي الوصفة الطبية، أما recipe فهي وصفة الطعام.',
        ),
        q(
          '___ I take this medicine after meals?',
          'Should',
          ['Am', 'Has', 'Does'],
          'نطلب النصيحة بـ Should I، ويأتي بعدها الفعل في صورته الأساسية.',
        ),
        q(
          'You ought ___ rest.',
          'to',
          ['for', 'at', 'by'],
          'التعبير الصحيح ought to + الفعل، ويعني «ينبغي».',
        ),
      ],
    },
  ],
};
