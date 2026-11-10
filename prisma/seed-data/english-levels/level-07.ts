import { q, type SeedLevel } from './types.js';

export const level07: SeedLevel = {
  title: 'Level 7',
  description:
    'مستوى فوق المتوسط الأول (CEFR B2). يعبر الطالب عن المواقف الافتراضية والندم، وينقل كلام الآخرين بدقة، ويتحكم في ترتيب الأحداث الماضية، ويستخدم المتلازمات اللفظية الشائعة.',
  modules: [
    {
      title: 'Unreal Conditions and Wishes',
      titleAr: 'الشرط غير الواقعي والتمني',
      description:
        'الجملة الشرطية الثانية والثالثة، والتعبير عن الأمنيات والندم بـ wish، وتقديم النصيحة بعبارة If I were you.',
      questions: [
        q(
          'If I ___ rich, I would travel the world.',
          'were',
          ['am', 'will be', 'have been'],
          'موقف غير واقعي في الحاضر، فنستخدم الشرط الثاني، وتستخدم were مع كل الضمائر في الأسلوب الرسمي.',
        ),
        q(
          'If I had known you were ill, I ___ you.',
          'would have visited',
          ['would visit', 'will visit', 'visited'],
          'الشرط الثالث عن ماضٍ لم يحدث: would have + التصريف الثالث.',
        ),
        q(
          'If she ___ harder, she would have passed.',
          'had studied',
          ['studied', 'has studied', 'would study'],
          'في الشرط الثالث يأتي الماضي التام بعد if.',
        ),
        q(
          'What would you do if you ___ a million dollars?',
          'won',
          ['win', 'will win', 'have won'],
          'الشرط الثاني: would في الجواب، والماضي البسيط بعد if.',
        ),
        q(
          'I wish I ___ speak Chinese.',
          'could',
          ['can', 'will', 'am able'],
          'للتمني عن قدرة غير موجودة في الحاضر نستخدم wish + could.',
        ),
        q(
          "I wish I ___ that. I'm sorry I said it.",
          "hadn't said",
          ["didn't say", "don't say", "won't say"],
          'الندم على أمر وقع في الماضي يكون بـ wish + الماضي التام.',
        ),
        q(
          'If I were you, I ___ accept that offer.',
          'would',
          ['will', 'am', 'had'],
          'عبارة If I were you لتقديم النصيحة، ويتبعها would + الفعل.',
        ),
        q(
          'We would have arrived on time if we ___ the train.',
          "hadn't missed",
          ["didn't miss", "don't miss", "wouldn't miss"],
          'الجواب would have يدل على الشرط الثالث، فيأتي الماضي التام بعد if.',
        ),
        q(
          'He wishes he ___ taller.',
          'were',
          ['is', 'will be', 'has been'],
          'التمني بأمر غير واقعي في الحاضر يكون بصيغة الماضي، وwere هي الأفصح.',
        ),
        q(
          '___ you had asked me, I would have helped.',
          'If',
          ['Unless', 'Although', 'Because'],
          'المعنى شرطي: «لو كنت طلبت مني لساعدتك».',
        ),
      ],
    },
    {
      title: 'Reported Speech',
      titleAr: 'الكلام المنقول',
      description:
        'نقل الجمل والأسئلة والأوامر، والتغيرات في الأزمنة والضمائر والظروف، والفرق بين said وtold.',
      questions: [
        q(
          '"I am tired," she said. → She said that she ___ tired.',
          'was',
          ['am', 'were', 'be'],
          'عند النقل يرجع المضارع البسيط خطوة إلى الماضي: am ← was.',
        ),
        q(
          '"I will call you," he told me. → He told me he ___ call me.',
          'would',
          ['does', 'is', 'has'],
          'تتحول will إلى would في الكلام المنقول.',
        ),
        q(
          '"I saw the film," Ali said. → Ali said he ___ the film.',
          'had seen',
          ['has saw', 'sees', 'see'],
          'يتحول الماضي البسيط إلى الماضي التام عند النقل.',
        ),
        q(
          '"Where do you live?" she asked. → She asked me where ___.',
          'I lived',
          ['did I live', 'do I live', 'I do live'],
          'في السؤال المنقول يكون ترتيب الكلمات كالجملة الخبرية بلا do أو did.',
        ),
        q(
          '"Are you coming?" he asked. → He asked ___ I was coming.',
          'if',
          ['that', 'what', 'did'],
          'ننقل سؤال yes/no باستخدام if أو whether.',
        ),
        q(
          '"Don\'t be late," the teacher said. → The teacher told us ___ late.',
          'not to be',
          ["don't be", 'to not being', 'not being'],
          'ننقل الأمر المنفي بتركيب told + مفعول + not to + الفعل.',
        ),
        q(
          'She ___ me that she was leaving.',
          'told',
          ['said', 'spoke', 'talked'],
          'told يليها مفعول به مباشر (me)، أما said فلا يليها الشخص مباشرة.',
        ),
        q(
          'He ___ that he was busy.',
          'said',
          ['told', 'talked', 'spoke'],
          'لا يوجد مفعول به يدل على شخص بعد الفراغ، لذلك نستخدم said.',
        ),
        q(
          '"I\'ll see you tomorrow," she said. → She said she would see me ___.',
          'the next day',
          ['tomorrow', 'yesterday', 'the last day'],
          'تتحول tomorrow إلى the next day أو the following day عند النقل.',
        ),
        q(
          '"I can swim," he said. → He said he ___ swim.',
          'could',
          ['would', 'should', 'must'],
          'تتحول can إلى could في الكلام المنقول.',
        ),
      ],
    },
    {
      title: 'Past Perfect and Collocations',
      titleAr: 'الماضي التام والمتلازمات اللفظية',
      description:
        'الماضي التام البسيط والمستمر لتوضيح تسلسل الأحداث، مع متلازمات شائعة بالأفعال make وdo والصفات.',
      questions: [
        q(
          'When I arrived, the train ___.',
          'had already left',
          ['already left', 'has left', 'leaves'],
          'مغادرة القطار سبقت الوصول، والحدث الأسبق يكون في الماضي التام.',
        ),
        q(
          'She was hungry because she ___ all day.',
          "hadn't eaten",
          ["doesn't eat", "hasn't eaten", "won't eat"],
          'سبب الجوع وقع قبل الحالة الماضية، فنستخدم الماضي التام.',
        ),
        q(
          'I ___ that man before, so I recognised him.',
          'had met',
          ['have met', 'meet', 'am meeting'],
          'اللقاء سبق التعرف في الماضي، فنستخدم الماضي التام.',
        ),
        q(
          'After they ___ dinner, they went for a walk.',
          'had eaten',
          ['have eaten', 'eat', 'are eating'],
          'بعد after يأتي الحدث الأسبق في الماضي التام.',
        ),
        q(
          'He ___ for two hours when the bus finally came.',
          'had been waiting',
          ['has been waiting', 'waits', 'is waiting'],
          'نشاط استمر مدة قبل حدث ماضٍ: الماضي التام المستمر.',
        ),
        q(
          'By 2010, she ___ three novels.',
          'had written',
          ['writes', 'has writing', 'is writing'],
          'التركيب by + وقت ماضٍ يدل على إنجاز تم قبل ذلك الوقت، فنستخدم الماضي التام.',
        ),
        q(
          'Everyone can ___ a mistake.',
          'make',
          ['do', 'take', 'have'],
          'المتلازمة الصحيحة make a mistake.',
        ),
        q(
          'I have to ___ my homework tonight.',
          'do',
          ['make', 'take', 'get'],
          'المتلازمة الصحيحة do homework.',
        ),
        q(
          'There was ___ rain all night.',
          'heavy',
          ['strong', 'big', 'thick'],
          'نصف المطر الغزير بكلمة heavy في الإنجليزية وليس strong.',
        ),
        q(
          'The company ___ a profit last year.',
          'made',
          ['did', 'took', 'went'],
          'المتلازمة الصحيحة make a profit، أي يحقق ربحاً.',
        ),
      ],
    },
  ],
};
