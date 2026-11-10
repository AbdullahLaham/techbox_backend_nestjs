import { q, type SeedLevel } from './types.js';

export const level11: SeedLevel = {
  title: 'Level 11',
  description:
    'مستوى الإتقان الأول (CEFR C2). يتعامل الطالب مع صيغة الـ subjunctive واللغة الرسمية والقانونية، والتعابير الاصطلاحية المتقدمة، والفروق الدقيقة بين الكلمات المتقاربة.',
  modules: [
    {
      title: 'The Subjunctive and Formal Register',
      titleAr: 'صيغة الـ Subjunctive والأسلوب الرسمي',
      description:
        'صيغة الفعل الأساسية بعد recommend وessential وdemand، والتعابير الثابتة مثل Come what may، ومفردات اللغة الرسمية والقانونية.',
      questions: [
        q(
          'The committee recommended that he ___ immediately.',
          'resign',
          ['resigns', 'resigned', 'will resign'],
          'بعد recommend that يأتي الفعل في صورته الأساسية مع جميع الفاعلين.',
        ),
        q(
          'It is essential that every student ___ present.',
          'be',
          ['being', 'been', 'were'],
          'بعد essential that نستخدم صيغة الـ subjunctive، وهي be مع جميع الفاعلين.',
        ),
        q(
          'I demand that she ___ told the truth.',
          'be',
          ['been', 'being', 'has'],
          'بعد demand that تأتي صيغة الـ subjunctive، وهنا في المبني للمجهول: be told.',
        ),
        q(
          '___ it not for your support, I would have given up.',
          'Were',
          ['Had', 'Was', 'Should'],
          'التعبير الرسمي الثابت Were it not for يعني «لولا».',
        ),
        q(
          'Far ___ it from me to criticise, but your report has several errors.',
          'be',
          ['being', 'been', 'is'],
          'التعبير الثابت Far be it from me يعني «لست ممن ينتقد، لكن...».',
        ),
        q(
          'Which sentence is the most formal?',
          'We acknowledge receipt of your letter.',
          ['We got your letter.', 'Your letter came.', "Yeah, we've got it."],
          'acknowledge receipt عبارة رسمية تستخدم في المراسلات الإدارية والقانونية.',
        ),
        q(
          '___ to the meeting, please read the attached report.',
          'Prior',
          ['Before', 'Earlier', 'Ahead'],
          'التعبير الرسمي Prior to يعني «قبل»، أما Before فلا يليها to.',
        ),
        q(
          'Failure to comply will ___ in a fine.',
          'result',
          ['lead', 'cause', 'bring'],
          'الفعل الذي يليه in هو result in، أما lead فيليها to.',
        ),
        q(
          'What does "notwithstanding" mean?',
          'In spite of',
          ['Because of', 'In addition to', 'Instead of'],
          'notwithstanding كلمة رسمية تعني «على الرغم من».',
        ),
        q(
          'Come what ___, I will finish this degree.',
          'may',
          ['might', 'must', 'will'],
          'التعبير الثابت Come what may يعني «مهما حدث».',
        ),
      ],
    },
    {
      title: 'Advanced Idioms',
      titleAr: 'التعابير الاصطلاحية المتقدمة',
      description:
        'فهم تعابير اصطلاحية شائعة لدى المتحدثين الأصليين، معناها لا يفهم من كلماتها الحرفية، واستخدامها في سياقها المناسب.',
      questions: [
        q(
          'What does "to bite the bullet" mean?',
          'To face something unpleasant with courage',
          [
            'To start a fight',
            'To speak without thinking',
            'To eat very quickly',
          ],
          'يعني التعبير الإقدام على أمر صعب لا مفر منه بشجاعة.',
        ),
        q(
          'What does "to let the cat out of the bag" mean?',
          'To reveal a secret by accident',
          [
            'To set an animal free',
            'To make a bad decision',
            'To forget something important',
          ],
          'يعني التعبير إفشاء سر، وغالباً دون قصد.',
        ),
        q(
          'What does "a storm in a teacup" mean?',
          'A lot of fuss about something unimportant',
          [
            'A sudden change in the weather',
            'A dangerous situation',
            'A very hot drink',
          ],
          'يعني التعبير ضجة كبيرة حول أمر تافه.',
        ),
        q(
          'What does "to sit on the fence" mean?',
          'To avoid choosing a side',
          [
            'To work outdoors',
            'To rest after hard work',
            'To watch others from far away',
          ],
          'يعني التعبير تجنب اتخاذ موقف واضح بين طرفين.',
        ),
        q(
          'What does "to bark up the wrong tree" mean?',
          'To look for a solution or blame in the wrong place',
          [
            'To shout at someone',
            'To make too much noise',
            'To climb somewhere dangerous',
          ],
          'يعني التعبير توجيه الجهد أو الاتهام إلى الجهة الخطأ.',
        ),
        q(
          'What does "to burn the midnight oil" mean?',
          'To work or study late into the night',
          ['To waste money', 'To get very angry', 'To start a project again'],
          'أصل التعبير من العمل على ضوء مصباح الزيت في الليل.',
        ),
        q(
          'What does it mean if someone has "a chip on their shoulder"?',
          'They feel resentful because they believe they were treated unfairly.',
          [
            'They have a minor injury.',
            'They are extremely confident.',
            'They have too much work.',
          ],
          'يصف التعبير شخصاً يحمل ضغينة بسبب شعوره بالظلم.',
        ),
        q(
          'What does "to pull someone\'s leg" mean?',
          'To joke with someone by telling them something untrue',
          [
            'To hurt someone',
            'To ask someone for help',
            'To stop someone from leaving',
          ],
          'يعني التعبير ممازحة شخص بإيهامه بشيء غير صحيح.',
        ),
        q(
          'What does "to add insult to injury" mean?',
          'To make a bad situation even worse',
          [
            'To apologise for an accident',
            'To treat a wound',
            'To ignore a problem',
          ],
          'يعني التعبير زيادة الأمر سوءاً بفعل أو قول إضافي.',
        ),
        q(
          'What does "once in a blue moon" mean?',
          'Very rarely',
          ['Every month', 'At night only', 'Without warning'],
          'يعني التعبير حدوث الشيء في مرات نادرة جداً.',
        ),
      ],
    },
    {
      title: 'Nuance: Near-Synonyms and Connotation',
      titleAr: 'الفروق الدقيقة: المترادفات والإيحاءات',
      description:
        'التمييز بين الكلمات متقاربة المعنى أو الشكل، وفهم الإيحاء الإيجابي والسلبي للكلمات، ومعاني المفردات الأدبية والرسمية.',
      questions: [
        q(
          'Which word describes someone careful with money in a negative way?',
          'stingy',
          ['thrifty', 'economical', 'prudent'],
          'stingy تعني بخيل وإيحاؤها سلبي، أما thrifty وprudent فإيجابيتان.',
        ),
        q(
          'Which word is the most complimentary way to describe a thin person?',
          'slender',
          ['skinny', 'scrawny', 'bony'],
          'slender تعني رشيق وإيحاؤها إيجابي، بينما تحمل البقية إيحاءً سلبياً.',
        ),
        q(
          'He was ___ by the news, completely unable to speak.',
          'dumbfounded',
          ['bored', 'amused', 'irritated'],
          'dumbfounded تعني مذهولاً إلى حد العجز عن الكلام.',
        ),
        q(
          'What do you ___ from his remarks?',
          'infer',
          ['imply', 'refer', 'defer'],
          'المستمع هو من يستنتج (infer)، أما المتحدث فيلمح (imply).',
        ),
        q(
          'The new policy will ___ thousands of workers.',
          'affect',
          ['effect', 'effects', 'affection'],
          'affect فعل يعني «يؤثر في»، أما effect فاسم يعني «الأثر» في الغالب.',
        ),
        q(
          'That wine ___ the meal perfectly.',
          'complements',
          ['compliments', 'comprises', 'complies'],
          'complement تعني «يكمل»، أما compliment فتعني «يمدح».',
        ),
        q(
          'The ___ of the discovery cannot be overstated.',
          'significance',
          ['signature', 'signal', 'signification'],
          'significance تعني الأهمية، وcannot be overstated تعني أنها بالغة جداً.',
        ),
        q(
          'What is a "disinterested" judge?',
          'An impartial judge',
          ['A bored judge', 'A lazy judge', 'An unqualified judge'],
          'disinterested في الاستخدام الدقيق تعني محايد، بخلاف uninterested التي تعني غير مهتم.',
        ),
        q(
          'The minister gave an ___ reply, avoiding a clear answer.',
          'evasive',
          ['invasive', 'abrasive', 'explicit'],
          'evasive تعني مراوغاً، وهو ما يناسب تجنب الإجابة الواضحة.',
        ),
        q(
          'Which word is closest in meaning to "ostentatious"?',
          'showy',
          ['modest', 'shy', 'generous'],
          'ostentatious تعني التفاخر والمبالغة في إظهار الثراء أو الأهمية.',
        ),
      ],
    },
  ],
};
