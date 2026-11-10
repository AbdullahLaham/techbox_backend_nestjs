import { q, type SeedLevel } from './types.js';

const MEMORY = `Read the passage and answer the question.

It is tempting to regard memory as a faithful archive, a storehouse from which experiences can be retrieved intact. Decades of research suggest otherwise. Each act of recollection appears to be less a retrieval than a reconstruction, in which fragments of the original event are reassembled and, inevitably, coloured by what the rememberer has since learned, believed or wished. Witnesses who are utterly confident of their testimony may nonetheless be mistaken, a finding with uncomfortable implications for the courts. Yet to conclude that memory is merely unreliable would be to miss the point. A system that continually revises the past in light of the present may be precisely what allows us to draw useful lessons from experience, rather than being burdened with a perfect and indiscriminate record of it.`;

const AUTOMATION = `Read the passage and answer the question.

When a task is handed over to a machine, we tend to count only what has been gained: time, consistency, perhaps money. What is lost is harder to see, because it accumulates slowly and declares itself only in a crisis. Pilots who rely heavily on autopilot have been found to lose some of the manual skills they need when the system fails; it is precisely at such rare moments that human judgement is most in demand and, ironically, least in practice. None of this amounts to an argument against automation, whose benefits to safety are well documented. It does, however, call into question the comfortable assumption that humans can simply step back and supervise. Supervision, it turns out, is itself a skill, and one that atrophies without use.`;

export const level12: SeedLevel = {
  title: 'Level 12',
  description:
    'مستوى الإتقان الثاني (CEFR C2). يتحكم الطالب في التراكيب النحوية المتقدمة، ويحلل الأساليب البلاغية والنبرة، ويقرأ نصوصاً فكرية معقدة ويستنتج المعاني الضمنية وموقف الكاتب.',
  modules: [
    {
      title: 'Advanced Syntax: Ellipsis and Fronting',
      titleAr: 'التراكيب المتقدمة: الحذف والتقديم',
      description:
        'الحذف والاستبدال لتجنب التكرار، وتقديم عناصر الجملة للتوكيد، وتراكيب مثل So ... that وSuch ... that وMuch as.',
      questions: [
        q(
          'A: Will it rain tomorrow? B: I hope ___.',
          'not',
          ['no', "don't", 'nothing'],
          "I hope not اختصار لجملة I hope it won't rain.",
        ),
        q(
          'She can play the piano, and ___ can her sister.',
          'so',
          ['too', 'also', 'either'],
          'نستخدم so + الفعل المساعد + الفاعل للموافقة في الإثبات.',
        ),
        q(
          "He didn't enjoy the film, and neither ___ I.",
          'did',
          ['was', 'have', 'do'],
          'الفعل المساعد يطابق زمن الجملة الأولى، وهو الماضي البسيط did.',
        ),
        q(
          'I asked her to help, but she refused ___.',
          'to',
          ['it', 'that', 'so'],
          'يمكن حذف الفعل بعد to لتجنب التكرار، ويبقى to وحدها.',
        ),
        q(
          'Not that I ___ to complain, but the service was slow.',
          'want',
          ['wanting', 'to want', 'wants'],
          'بعد Not that تأتي جملة كاملة بفاعل وفعل مصرف، ومع I نقول want.',
        ),
        q(
          'Strange ___ it may seem, I enjoyed the exam.',
          'as',
          ['like', 'so', 'how'],
          'التركيب الرسمي صفة + as + فاعل + فعل يعني «مهما بدا غريباً».',
        ),
        q(
          'So difficult ___ that few students finished it.',
          'was the exam',
          ['the exam was', 'the exam', 'did the exam'],
          'عند تقديم So + صفة إلى أول الجملة يتقدم الفعل على الفاعل.',
        ),
        q(
          'Such ___ his anger that nobody dared to speak.',
          'was',
          ['were', 'has', 'did'],
          'التركيب Such + be + فاعل + that، والفاعل anger مفرد في الماضي.',
        ),
        q(
          'On the hill ___ an ancient castle.',
          'stands',
          ['stand', 'standing', 'is stand'],
          'عند تقديم عبارة المكان يتقدم الفعل على الفاعل، والفاعل الحقيقي castle مفرد.',
        ),
        q(
          'Much ___ I admire his work, I cannot agree with his conclusions.',
          'as',
          ['like', 'so', 'than'],
          'التعبير Much as يعني «مع أنني كثيراً ما...» ويفيد التضاد.',
        ),
      ],
    },
    {
      title: 'Rhetoric, Style and Tone',
      titleAr: 'البلاغة والأسلوب والنبرة',
      description:
        'التعرف على الأساليب البلاغية مثل الاستعارة والتشبيه والمبالغة والمفارقة، وتحليل النبرة والسخرية في النصوص الإنجليزية.',
      questions: [
        q(
          '"Time is a thief." What is this an example of?',
          'Metaphor',
          ['Simile', 'Alliteration', 'Onomatopoeia'],
          'الاستعارة تصف شيئاً بأنه شيء آخر مباشرة، دون like أو as.',
        ),
        q(
          '"As brave as a lion." What is this an example of?',
          'Simile',
          ['Metaphor', 'Hyperbole', 'Irony'],
          'التشبيه simile يقارن صراحةً باستخدام as أو like.',
        ),
        q(
          '"I\'ve told you a million times!" What is this an example of?',
          'Hyperbole',
          ['Euphemism', 'Oxymoron', 'Alliteration'],
          'hyperbole هي المبالغة المقصودة وليست عدداً حقيقياً.',
        ),
        q(
          'Saying "he passed away" instead of "he died" is an example of ___.',
          'euphemism',
          ['hyperbole', 'irony', 'paradox'],
          'euphemism هو استخدام تعبير ألطف بدلاً من تعبير مباشر قاسٍ.',
        ),
        q(
          '"A deafening silence." What is this an example of?',
          'Oxymoron',
          ['Simile', 'Euphemism', 'Onomatopoeia'],
          'oxymoron هو الجمع بين كلمتين متناقضتين في المعنى.',
        ),
        q(
          '"Peter Piper picked a peck of pickled peppers." What is this an example of?',
          'Alliteration',
          ['Personification', 'Hyperbole', 'Paradox'],
          'alliteration هي تكرار الصوت الأول في كلمات متتالية، وهو هنا p.',
        ),
        q(
          '"The wind whispered through the trees." What is this an example of?',
          'Personification',
          ['Alliteration', 'Euphemism', 'Simile'],
          'personification هو إسناد صفة بشرية (الهمس) إلى غير الإنسان.',
        ),
        q(
          'A fire station burning down is an example of ___.',
          'irony',
          ['alliteration', 'simile', 'euphemism'],
          'المفارقة الموقفية هي وقوع عكس ما نتوقعه، فالمكان المخصص لإطفاء الحرائق يحترق.',
        ),
        q(
          'A tired employee says: "Oh, wonderful, another meeting." What is the tone?',
          'Sarcastic',
          ['Sincere', 'Enthusiastic', 'Respectful'],
          'يقول الموظف عكس ما يقصد، وهذا هو أسلوب السخرية.',
        ),
        q(
          'A speaker asks, "Who doesn\'t want to be happy?" without expecting an answer. What is this?',
          'A rhetorical question',
          ['An oxymoron', 'A direct quotation', 'A metaphor'],
          'السؤال البلاغي يطرح لإحداث أثر، وليس لانتظار إجابة.',
        ),
      ],
    },
    {
      title: 'Proficiency Reading',
      titleAr: 'القراءة على مستوى الإتقان',
      description:
        'قراءة نصين فكريين عن الذاكرة البشرية وآثار الأتمتة، واستخراج الفكرة الرئيسية والمعاني الضمنية ومعاني الكلمات من السياق وموقف الكاتب.',
      questions: [
        q(
          `${MEMORY}\n\nWhat is the author's main argument?`,
          'Memory reconstructs the past, and this flexibility may be useful despite its risks.',
          [
            'Memory is a faithful record of past events.',
            'Courts should stop using witnesses altogether.',
            'Memory always gets worse as people grow older.',
          ],
          'ينتهي الكاتب إلى أن إعادة بناء الذكريات عرضة للخطأ لكنها قد تكون مفيدة في التعلم من التجربة.',
        ),
        q(
          `${MEMORY}\n\nWhat does the phrase "less a retrieval than a reconstruction" suggest?`,
          'Remembering is closer to rebuilding an event than to fetching a stored copy.',
          [
            'Remembering is impossible without physical records.',
            'Stored memories can never be damaged.',
            'People remember less than they did in the past.',
          ],
          'التركيب less A than B يعني أن الوصف B أدق من الوصف A.',
        ),
        q(
          `${MEMORY}\n\nWhat does the author imply about confident witnesses?`,
          'Their confidence does not guarantee that they are accurate.',
          [
            'They are usually lying on purpose.',
            'They are always reliable in court.',
            'They should be excluded from every trial.',
          ],
          'تقول العبارة may nonetheless be mistaken إن الثقة قد تجتمع مع الخطأ، دون اتهام بالكذب.',
        ),
        q(
          `${MEMORY}\n\nThe phrase "coloured by" in the passage is closest in meaning to ___.`,
          'influenced by',
          ['painted with', 'hidden by', 'confirmed by'],
          'المعنى هنا مجازي: تتأثر الذكرى بما تعلمه الشخص أو اعتقده لاحقاً.',
        ),
        q(
          `${MEMORY}\n\nWhat does the author do in the final two sentences?`,
          'Presents a possible advantage of a seemingly flawed system',
          [
            'Rejects all the research mentioned earlier',
            'Recommends a method for training memory',
            'Summarises a series of court cases',
          ],
          'الكلمة Yet تبدأ تحولاً نحو الفائدة المحتملة لمراجعة الذاكرة المستمرة للماضي.',
        ),
        q(
          `${AUTOMATION}\n\nWhat is the main point of the passage?`,
          'Automation has real benefits but may weaken the skills needed when it fails.',
          [
            'Automation should be removed from aircraft.',
            'Machines are less consistent than people.',
            'Pilots no longer need any training.',
          ],
          'يقر الكاتب بفوائد الأتمتة ويحذر في الوقت نفسه من تراجع المهارات البشرية.',
        ),
        q(
          `${AUTOMATION}\n\nWhy does the author use the word "ironically"?`,
          'Human skill is needed most at the moments when it has been practised least.',
          [
            'Pilots enjoy failures more than normal flights.',
            'Autopilot systems fail very frequently.',
            'Human judgement is rarely useful in a crisis.',
          ],
          'المفارقة أن الحاجة إلى المهارة تبلغ أقصاها عندما تكون الممارسة في أدناها.',
        ),
        q(
          `${AUTOMATION}\n\nWhat is the author's position on automation?`,
          'The author accepts its benefits but questions one common assumption about it.',
          [
            'The author is firmly against all automation.',
            'The author believes it has no safety benefits.',
            'The author thinks humans can simply step back and supervise.',
          ],
          'تصرح العبارة None of this amounts to an argument against automation بعدم رفض الأتمتة، ثم ينتقد افتراض سهولة الإشراف.',
        ),
        q(
          `${AUTOMATION}\n\nThe word "atrophies" in the passage is closest in meaning to ___.`,
          'weakens gradually',
          ['grows rapidly', 'is replaced', 'becomes expensive'],
          'atrophy تعني الضمور، أي الضعف التدريجي بسبب قلة الاستخدام.',
        ),
        q(
          `${AUTOMATION}\n\nWhat does "declares itself only in a crisis" mean?`,
          'The loss becomes visible only when something goes wrong.',
          [
            'Crises are always announced in advance.',
            'Machines warn people before they fail.',
            'The loss is reported to the authorities.',
          ],
          'يقصد الكاتب أن فقدان المهارة يبقى خفياً حتى تقع أزمة تكشفه.',
        ),
      ],
    },
  ],
};
