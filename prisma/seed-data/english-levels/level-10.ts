import { q, type SeedLevel } from './types.js';

export const level10: SeedLevel = {
  title: 'Level 10',
  description:
    'المستوى المتقدم الثاني (CEFR C1). يكتب الطالب بأسلوب مكثف باستخدام جمل اسم الفاعل والمفعول، ويستخدم لغة الأعمال وتعابيرها، ويتقن أدوات الخطاب والتحفظ في الكتابة الأكاديمية.',
  modules: [
    {
      title: 'Participle Clauses',
      titleAr: 'جمل اسم الفاعل والمفعول',
      description:
        'اختصار الجمل بصيغ ing والتصريف الثالث وhaving done، وجمل الوصل المختصرة، وتجنب الخطأ الشائع في ربط جملة الفاعل بغير صاحبها.',
      questions: [
        q(
          '___ the letter, she burst into tears.',
          'Having read',
          ['Have read', 'Had read', 'To have read'],
          'Having + التصريف الثالث يدل على حدث اكتمل قبل الحدث الرئيسي، وفاعله هو she.',
        ),
        q(
          'The man ___ over there is my boss.',
          'standing',
          ['stood', 'who standing', 'stands'],
          'standing اختصار لجملة الوصل who is standing.',
        ),
        q(
          'The book, ___ in 1950, is still popular.',
          'written',
          ['writing', 'wrote', 'to write'],
          'الكتاب يُكتب، فنستخدم التصريف الثالث للمعنى المجهول.',
        ),
        q(
          '___ from the plane, the city looked tiny.',
          'Seen',
          ['Seeing', 'Saw', 'See'],
          'المدينة هي التي تُرى، فنستخدم التصريف الثالث للمعنى المجهول.',
        ),
        q(
          'Not ___ what to say, he remained silent.',
          'knowing',
          ['known', 'know', 'knew'],
          'جملة الفاعل المنفية تتكون من Not + فعل ing، وهي تبين السبب هنا.',
        ),
        q(
          'Which sentence uses the participle clause correctly?',
          'Walking down the street, I saw an old friend.',
          [
            'Walking down the street, an old friend was seen by me.',
            'Walking down the street, the rain started.',
            'Walked down the street, I saw an old friend.',
          ],
          'يجب أن يكون فاعل الجملة الرئيسية هو من يقوم بالمشي، وهو I.',
        ),
        q(
          'All the people ___ to the event received a gift.',
          'invited',
          ['inviting', 'invite', 'invites'],
          'الناس هم المدعوون، فنستخدم التصريف الثالث، وهو اختصار لـ who were invited.',
        ),
        q(
          '___ finished the report, she left the office.',
          'Having',
          ['Had', 'Have', 'Has'],
          'تركيب الجملة المختصرة: Having + التصريف الثالث.',
        ),
        q(
          'The weather ___ fine, we went for a picnic.',
          'being',
          ['been', 'was', 'is'],
          'جملة مطلقة بفاعل مستقل تعني «ولأن الطقس كان جميلاً».',
        ),
        q(
          'Anyone ___ to leave early must ask permission.',
          'wishing',
          ['wished', 'wish', 'wishes'],
          'wishing اختصار لجملة الوصل who wishes.',
        ),
      ],
    },
    {
      title: 'Business English: Collocations and Idioms',
      titleAr: 'لغة الأعمال: المتلازمات والتعابير',
      description:
        'متلازمات لفظية وتعابير اصطلاحية شائعة في بيئة العمل والاجتماعات والتفاوض ووصف الأداء المالي.',
      questions: [
        q(
          'We have to ___ the deadline, or we will lose the client.',
          'meet',
          ['do', 'make up', 'win'],
          'المتلازمة الصحيحة meet a deadline بمعنى الالتزام بالموعد النهائي.',
        ),
        q(
          'The board will ___ a meeting on Monday.',
          'hold',
          ['make', 'do', 'set off'],
          'المتلازمة الصحيحة hold a meeting بمعنى يعقد اجتماعاً.',
        ),
        q(
          'What does "to think outside the box" mean?',
          'To think creatively and in new ways',
          [
            'To work from home',
            'To follow the rules exactly',
            'To pack things carefully',
          ],
          'يعني التعبير التفكير بطريقة إبداعية خارج الأنماط المعتادة.',
        ),
        q(
          'What does "the ball is in your court" mean?',
          'It is your turn to act or decide.',
          [
            'You have won the deal.',
            'You have made a mistake.',
            'You must play a sport.',
          ],
          'التعبير مأخوذ من التنس ويعني أن القرار أو الخطوة التالية عندك.',
        ),
        q(
          'What does "to cut corners" mean?',
          'To do something cheaply or quickly, at the expense of quality',
          [
            'To plan something very carefully',
            'To redesign an office',
            'To reduce the price for customers',
          ],
          'يعني التعبير اختصار الجهد أو التكلفة على حساب الجودة أو القواعد.',
        ),
        q(
          'The company plans to ___ its new product in March.',
          'launch',
          ['throw', 'shoot', 'rise'],
          'launch a product تعني طرح منتج جديد في السوق.',
        ),
        q(
          'Sales have ___ sharply this quarter.',
          'risen',
          ['raised', 'arisen', 'aroused'],
          'rise فعل لازم لا يحتاج إلى مفعول به، وتصريفه الثالث risen، أما raise فمتعدٍ.',
        ),
        q(
          'What does it mean when a business "breaks even"?',
          'It makes neither a profit nor a loss.',
          [
            'It loses all its money.',
            'It breaks a contract.',
            'It doubles its profit.',
          ],
          'break even تعني أن الإيرادات تساوي التكاليف.',
        ),
        q(
          'We reached a ___ after long negotiations; both sides gave up something.',
          'compromise',
          ['competition', 'commitment', 'complaint'],
          'compromise هي الحل الوسط الذي يتنازل فيه كل طرف عن شيء.',
        ),
        q(
          'What does "to get the hang of something" mean?',
          'To learn how to do it',
          ['To give it up', 'To dislike it', 'To put it on a wall'],
          'يعني التعبير اكتساب المهارة في شيء بعد التدرب عليه.',
        ),
      ],
    },
    {
      title: 'Discourse Markers and Academic Style',
      titleAr: 'أدوات الخطاب والأسلوب الأكاديمي',
      description:
        'تنظيم الأفكار بأدوات الربط والمقابلة والنتيجة، والتحفظ في الكتابة الأكاديمية، واختيار المفردات الرسمية بدلاً من العامية.',
      questions: [
        q(
          'Which sentence uses cautious academic language (hedging)?',
          'The results suggest that the drug may be effective.',
          [
            'The results prove that the drug always works.',
            'This is definitely the best drug ever made.',
            'Nobody can deny that the drug works perfectly.',
          ],
          'تدل suggest وmay على التحفظ وعدم الجزم، وهما من سمات الكتابة الأكاديمية.',
        ),
        q(
          'Many tests were carried out. ___, the evidence remains inconclusive.',
          'Nevertheless',
          ['Because', 'In order to', 'So that'],
          'Nevertheless تفيد التضاد بين جملتين: رغم الاختبارات ما زال الدليل غير قاطع.',
        ),
        q(
          'The plan is expensive. ___, it would take years to complete.',
          'Furthermore',
          ['Although', 'Whereas', 'Instead of'],
          'Furthermore تضيف نقطة أخرى في نفس الاتجاه، فكلتاهما من العيوب.',
        ),
        q(
          'Some people prefer the city, ___ others prefer the countryside.',
          'whereas',
          ['moreover', 'therefore', 'thus'],
          'whereas تربط بين فكرتين متقابلتين داخل جملة واحدة.',
        ),
        q(
          'The factory closed; ___, hundreds of people lost their jobs.',
          'consequently',
          ['nevertheless', 'likewise', 'in contrast'],
          'consequently تدل على النتيجة، وفقدان الوظائف نتيجة لإغلاق المصنع.',
        ),
        q(
          '___ to popular belief, bats are not blind.',
          'Contrary',
          ['Opposite', 'Against', 'Despite'],
          'التعبير الثابت Contrary to popular belief يعني «خلافاً للاعتقاد الشائع».',
        ),
        q(
          'What does "to a certain extent" signal in an essay?',
          'Partial agreement',
          ['Complete disagreement', 'A final conclusion', 'A new example'],
          'يعني التعبير «إلى حد ما»، أي موافقة جزئية.',
        ),
        q(
          'To sum ___, the study shows two main trends.',
          'up',
          ['out', 'in', 'over'],
          'To sum up عبارة تستخدم لتلخيص الأفكار.',
        ),
        q(
          'With ___ to your question, the answer is still under review.',
          'regard',
          ['regarding', 'regarded', 'regardless'],
          'التعبير الثابت هو with regard to بمعنى «فيما يتعلق بـ».',
        ),
        q(
          'Which phrase is the most suitable academic alternative to "a lot of"?',
          'a considerable amount of',
          ['loads of', 'tons of', 'heaps of'],
          'الخيارات الأخرى عامية ولا تناسب الكتابة الأكاديمية.',
        ),
      ],
    },
  ],
};
