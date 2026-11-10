import { q, type SeedLevel } from './types.js';

const URBAN_HEAT = `Read the passage and answer the question.

Cities are often several degrees warmer than the countryside around them, a phenomenon known as the urban heat island effect. Concrete and asphalt absorb sunlight during the day and release it slowly at night, while the lack of vegetation reduces the natural cooling that plants provide through evaporation. The consequences extend beyond discomfort: heatwaves in densely populated areas have been linked to higher rates of illness and mortality, particularly among the elderly. Some municipalities have responded by planting trees and installing reflective roofs. Although such measures cannot eliminate the problem entirely, early studies suggest that they can lower local temperatures noticeably, often at a modest cost compared with the health care expenses they help to avoid.`;

export const level09: SeedLevel = {
  title: 'Level 9',
  description:
    'المستوى المتقدم الأول (CEFR C1). يستخدم الطالب تراكيب التوكيد والتقديم، ويعبر عن المواقف الافتراضية المعقدة، ويتعامل مع المفردات الأكاديمية ونصوص القراءة الطويلة.',
  modules: [
    {
      title: 'Inversion and Emphasis',
      titleAr: 'التقديم والتوكيد',
      description:
        'تقديم الفعل المساعد بعد التعابير المنفية مثل Never وNot only وNo sooner، وجمل التوكيد (cleft sentences) مثل It was ... who وWhat I need is.',
      questions: [
        q(
          'Never ___ such a beautiful view.',
          'have I seen',
          ['I have seen', 'I saw', 'seen I have'],
          'عند بدء الجملة بتعبير منفي مثل Never يتقدم الفعل المساعد على الفاعل.',
        ),
        q(
          'Not only ___ late, but he also forgot the documents.',
          'did he arrive',
          ['he arrived', 'arrived he', 'he did arrive'],
          'بعد Not only في أول الجملة يتقدم الفعل المساعد، وفي الماضي البسيط نستخدم did.',
        ),
        q(
          'Hardly ___ home when it started to rain.',
          'had I got',
          ['I had got', 'did I got', 'I got'],
          'التركيب الصحيح Hardly + had + فاعل + التصريف الثالث + when.',
        ),
        q(
          'No sooner ___ the door than the phone rang.',
          'had she closed',
          ['she had closed', 'she closed', 'closed she'],
          'التركيب الصحيح No sooner + had + فاعل + التصريف الثالث + than.',
        ),
        q(
          'Only after the meeting ___ the truth.',
          'did I learn',
          ['I learned', 'learned I', 'I did learn'],
          'بعد Only after + اسم في أول الجملة يأتي الفعل المساعد قبل الفاعل.',
        ),
        q(
          'Under no circumstances ___ leave this room.',
          'should you',
          ['you should', 'you', 'do you should'],
          'Under no circumstances تعبير منفي، فيتقدم الفعل المساعد should على الفاعل.',
        ),
        q(
          'It was Ali ___ broke the window.',
          'who',
          ['which', 'what', 'where'],
          'جملة التوكيد It was + شخص + who تبرز الفاعل.',
        ),
        q(
          '___ I need is a long holiday.',
          'What',
          ['That', 'Which', 'It'],
          'جملة التوكيد What + فاعل + فعل + is تبرز ما نريد التركيز عليه.',
        ),
        q(
          'Little ___ that the police were watching him.',
          'did he know',
          ['he knew', 'knew he', 'he did know'],
          'Little في أول الجملة لها معنى النفي، فيتقدم الفعل المساعد did.',
        ),
        q(
          '___ had the sun risen than they set off.',
          'No sooner',
          ['Hardly', 'Barely', 'Scarcely'],
          'وجود than يحدد No sooner، أما Hardly وBarely وScarcely فتستخدم مع when.',
        ),
      ],
    },
    {
      title: 'Mixed Conditionals and Hypothetical Meaning',
      titleAr: 'الشرط المختلط والمعنى الافتراضي',
      description:
        "الربط بين الماضي والحاضر في الشرط المختلط، وحذف if مع التقديم، وتراكيب It's high time وwould rather وas if وBut for.",
      questions: [
        q(
          'If I had taken that job, I ___ rich now.',
          'would be',
          ['would have been', 'will be', 'am'],
          'شرط في الماضي ونتيجة في الحاضر (now)، وهذا هو الشرط المختلط.',
        ),
        q(
          "If she weren't so shy, she ___ to the party last night.",
          'would have gone',
          ['would go', 'will go', 'goes'],
          'صفة دائمة في الحاضر أثرت في حدث ماضٍ (last night)، فتكون النتيجة would have + التصريف الثالث.',
        ),
        q(
          "It's high time you ___ a job.",
          'found',
          ['find', 'will find', 'have found'],
          "بعد It's high time يأتي الماضي البسيط رغم أن المعنى للحاضر.",
        ),
        q(
          "I'd rather you ___ smoke here.",
          "didn't",
          ["don't", "won't", 'not'],
          'عندما يختلف الفاعل بعد would rather نستخدم الماضي البسيط.',
        ),
        q(
          'Had I known about the traffic, I ___ earlier.',
          'would have left',
          ['would leave', 'left', 'had left'],
          'Had I known تعني If I had known، وهو الشرط الثالث.',
        ),
        q(
          '___ you need any help, please call me.',
          'Should',
          ['Would', 'Did', 'Had'],
          'Should في أول الجملة صيغة رسمية تعني If you should.',
        ),
        q(
          'Were he ___ the truth, he would be furious.',
          'to learn',
          ['learning', 'learned', 'learns'],
          'التركيب الرسمي Were + فاعل + to + الفعل يعبر عن احتمال مستبعد.',
        ),
        q(
          'But for your help, I ___ failed.',
          'would have',
          ['will have', 'had', 'would'],
          'But for تعني «لولا»، وتأخذ في الماضي جواباً بصيغة would have + التصريف الثالث.',
        ),
        q(
          'Suppose you ___ lost in the desert — what would you do?',
          'got',
          ['will get', 'have got', 'getting'],
          'بعد Suppose مع موقف افتراضي نستخدم الماضي البسيط، ويتوافق ذلك مع would.',
        ),
        q(
          "He talks as if he ___ everything, but in fact he doesn't.",
          'knew',
          ['will know', 'is knowing', 'knowing'],
          'بعد as if لموقف غير حقيقي نستخدم الماضي البسيط، كما أن know لا يأتي في الاستمرار.',
        ),
      ],
    },
    {
      title: 'Academic Vocabulary and Reading',
      titleAr: 'المفردات الأكاديمية والقراءة',
      description:
        'فهم نص أكاديمي عن الجزر الحرارية في المدن: الفكرة الرئيسية والتفاصيل والاستنتاج وموقف الكاتب، إلى جانب مفردات شائعة في الكتابة الأكاديمية.',
      questions: [
        q(
          `${URBAN_HEAT}\n\nWhat is the passage mainly about?`,
          'Why cities are hotter, why this matters and how it can be reduced',
          [
            'Why concrete is a poor building material',
            'Why elderly people should leave cities',
            'Why reflective roofs are too expensive',
          ],
          'يعرض النص سبب الظاهرة ثم آثارها ثم حلولها، فالخيار الصحيح يجمع الأجزاء الثلاثة.',
        ),
        q(
          `${URBAN_HEAT}\n\nAccording to the passage, how do plants help to cool an area?`,
          'Through evaporation',
          [
            'By reflecting sunlight',
            'By releasing heat at night',
            'By blocking the wind',
          ],
          'يذكر النص صراحةً: the natural cooling that plants provide through evaporation.',
        ),
        q(
          `${URBAN_HEAT}\n\nThe word "mortality" in the passage is closest in meaning to ___.`,
          'the number of deaths',
          ['hospital care', 'old age', 'poor health'],
          'mortality تعني معدل الوفيات، وقد وردت بعد illness لتضيف نتيجة أشد منه.',
        ),
        q(
          `${URBAN_HEAT}\n\nWhat can be inferred about planting trees and installing reflective roofs?`,
          'They reduce the problem but do not solve it completely.',
          [
            'They solve the problem completely.',
            'They have never been tested.',
            'They cost more than the health care they help to avoid.',
          ],
          'تقول الجملة: cannot eliminate the problem entirely لكنها can lower local temperatures noticeably.',
        ),
        q(
          `${URBAN_HEAT}\n\nWhat is the author's attitude towards these measures?`,
          'Cautiously positive',
          ['Strongly opposed', 'Completely indifferent', 'Openly mocking'],
          'يعترف الكاتب بحدود الحلول (Although) لكنه يذكر فوائدها، وهذا تفاؤل حذر.',
        ),
        q(
          'The results ___ the theory that sleep improves memory.',
          'support',
          ['depend', 'rely', 'consist'],
          'support the theory تعني «تدعم النظرية»، وهي متلازمة أكاديمية شائعة.',
        ),
        q(
          'The data show a ___ increase in sales.',
          'significant',
          ['significance', 'signify', 'signifies'],
          'نحتاج إلى صفة تصف الاسم increase، والصفة هي significant.',
        ),
        q(
          'Researchers must ___ their data carefully before drawing conclusions.',
          'analyse',
          ['analysis', 'analytical', 'analyst'],
          'بعد must نحتاج إلى فعل، أما analysis فاسم وanalytical صفة وanalyst اسم لشخص.',
        ),
        q(
          'Which word is closest in meaning to "nevertheless"?',
          'however',
          ['therefore', 'moreover', 'for example'],
          'تفيد الكلمتان التضاد مع ما سبق، بمعنى «ومع ذلك».',
        ),
        q(
          'The study ___ of three parts.',
          'consists',
          ['contains', 'includes', 'composes'],
          'الفعل الذي يأتي مع of هو consist of، أما contain وinclude فيتبعهما المفعول مباشرة.',
        ),
      ],
    },
  ],
};
