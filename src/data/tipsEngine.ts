/** Author: BinaryBeast1209 */
import type { ScanRecord } from '../scan/types';
import type { AcuityConfirmedReport } from '../scan/acuityStore';
import { toneFor } from '../scan/measure';
import type { ParentPrefs } from './parentPrefsStore';

export type TipCategory = 'action' | 'habit' | 'comfort' | 'access';

export type TipCard = {
  id: string;
  category: TipCategory;
  categoryLabel: string;
  badgeTone: 'danger' | 'warning' | 'success' | 'accent' | 'neutral';
  whyYouSeeThis: string;
  title: string;
  body: string;
  keyDetails?: string[];
  isFreeHabit?: boolean;
  priority: number;
};

export type PatientContext = {
  scans: ScanRecord[];
  acuityReport: AcuityConfirmedReport | null;
  prefs: ParentPrefs;
  childName: string;
};

export function evaluateTips(ctx: PatientContext): TipCard[] {
  const { scans, acuityReport, prefs, childName } = ctx;

  const hasScans = scans.length > 0;
  const isMyopiaScanFlagged = hasScans && toneFor('near', scans) === 'watch';
  const isAnyScanFlagged = hasScans && (['near', 'far', 'astigmatism', 'aniso', 'alignment'] as const).some(
    (k) => toneFor(k, scans) === 'watch',
  );
  const isAcuityFlagged =
    acuityReport != null && (acuityReport.overallBadge === 'warning' || acuityReport.overallBadge === 'danger');
  const isFlagged = isAnyScanFlagged || isAcuityFlagged;
  const isClear = hasScans && !isFlagged;

  const cards: TipCard[] = [];

  // ==========================================
  // JOB 2: WHAT TO DO AFTER A RESULT
  // ==========================================

  if (isFlagged) {
    // Top Priority Card: See an Eye Doctor
    cards.push({
      id: 'referral_doctor',
      category: 'action',
      categoryLabel: 'Recommended Action',
      badgeTone: 'danger',
      whyYouSeeThis: isAcuityFlagged
        ? `Because ${childName}’s latest acuity chart reading showed reduced uncorrected distance vision.`
        : `Because ${childName}’s recent ocular photo showed optical crescent asymmetry that warrants clinical confirmation.`,
      title: 'Schedule a Comprehensive Pediatric Eye Exam',
      body: 'Optix is an automated screening companion, not a medical diagnosis. Only an optometrist or ophthalmologist can confirm whether your child needs glasses through a professional dilated examination.',
      keyDetails: [
        'What to bring: Any existing glasses, school vision screening notes, and notes on family vision history.',
        'What to ask: Ask the doctor for a formal dilated cycloplegic refraction and whether distance glasses are needed.',
        'Classroom impact: Share if your child sits far from the board, squints, or rubs their eyes during schoolwork.',
      ],
      priority: 100,
    });
  }

  if (isMyopiaScanFlagged || (isAcuityFlagged && isMyopiaScanFlagged)) {
    // What to discuss with doctor if myopia is present
    cards.push({
      id: 'doctor_myopia_options',
      category: 'action',
      categoryLabel: 'Clinical Discussion',
      badgeTone: 'warning',
      whyYouSeeThis: `Because ${childName}’s scan highlighted optical markers associated with nearsighted focus.`,
      title: 'Discuss Progression Management with Your Doctor',
      body: 'Daily lifestyle habits help protect general eye comfort, but if an eye doctor confirms your child has myopia, they may evaluate clinical methods designed to help slow progression. These require clinical prescription and regular doctor monitoring.',
      keyDetails: [
        'Low-Dose Atropine Drops: Prescription nighttime drops clinically evaluated in pediatric trials (such as the ATOM and LAMP studies) to help moderate axial eye elongation.',
        'Specialty Defocus Spectacle Lenses: Eyeglass lenses designed with peripheral defocus optics.',
        'Overnight Orthokeratology (Ortho-K): Custom rigid gas-permeable lenses worn during sleep to temporarily reshape the cornea.',
        'Medical decision: Optix does not prescribe or guarantee outcomes. Discuss options with your licensed eye doctor.',
      ],
      priority: 85,
    });
  }

  if (isClear) {
    // Clear Result: Reassurance + AAPOS Rescan Guidance
    cards.push({
      id: 'clear_scan_routine',
      category: 'action',
      categoryLabel: 'Screening Routine',
      badgeTone: 'success',
      whyYouSeeThis: `Because ${childName}’s latest scan and acuity test showed healthy, steady optical reflections.`,
      title: 'Maintain Routine Pediatric Checkups',
      body: 'A clear screening result is encouraging, but camera screening does not replace regular professional eye exams. Visual needs change rapidly during school years as children grow.',
      keyDetails: [
        'Rescan Interval (AAPOS / AAO Guidelines): Pediatric guidelines recommend formal vision screenings every 1 to 2 years for asymptomatic school-age children, or annually at routine well-child pediatrician checkups.',
        'Keep monitoring: Take an Optix check scan every 3 to 6 months to maintain a record of optical reflection symmetry.',
      ],
      priority: 95,
    });
  }

  // ==========================================
  // JOB 1: HABITS THAT LOWER RISK (ALL $0)
  // ==========================================

  // Habit A: Outdoor daylight time
  cards.push({
    id: 'habit_outdoor',
    category: 'habit',
    categoryLabel: 'Free Daily Habit',
    badgeTone: 'accent',
    isFreeHabit: true,
    whyYouSeeThis:
      prefs.outdoorHoursPerDay < 2
        ? `Because you logged ${prefs.outdoorHoursPerDay} hr of daily outdoor light (pediatric guidelines recommend ~2 hrs).`
        : `Because clinical evidence shows daily natural daylight is the single strongest environmental protector against developing myopia.`,
    title: 'Aim for ~2 Hours of Daily Outdoor Daylight',
    body: 'In clinical trials, outdoor daylight exposure cut the risk of developing myopia by roughly half. In dose-response analyses, increasing time outside from 3.5 hrs/week up to 16–27 hrs/week was associated with 53% to 69% lower risk.',
    keyDetails: [
      'Mechanism: Bright natural sunlight stimulates retinal dopamine release, which helps regulate healthy eye growth.',
      'Developing vs. existing: Strongest clinical evidence is for lowering the risk of developing myopia; evidence for slowing it in children who already have it is mixed.',
      'Zero Cost ($0): Park visits, backyard play, or outdoor recess count fully toward the daily target.',
    ],
    priority: isFlagged ? 80 : 90,
  });

  // Habit B: Viewing distance (30 cm / 12 inches)
  cards.push({
    id: 'habit_distance',
    category: 'habit',
    categoryLabel: 'Free Daily Habit',
    badgeTone: 'accent',
    isFreeHabit: true,
    whyYouSeeThis:
      'Because sustained close viewing under 25 cm is an established independent risk factor for developing myopia.',
    title: 'Keep Books & Screens at Least 30 cm (12+ Inches) Away',
    body: 'Holding reading materials or phones too close strains the eye’s focusing muscles. Pediatric guidelines flag close work under 25 cm as a risk factor, while Apple’s Screen Distance feature uses a 30 cm (12-inch) threshold.',
    keyDetails: [
      'The Harmon Distance rule: A child’s reading distance should be at least the distance from their elbow to their middle knuckle.',
      'Check phone posture: Remind children not to curl over phones or read under heavy blankets in the dark.',
      'Zero Cost ($0): Adjusting screen distance costs nothing and immediately reduces accommodative eye strain.',
    ],
    priority: 75,
  });

  // Habit C: Break reminders & 20-20-20 rule
  cards.push({
    id: 'habit_breaks',
    category: 'comfort',
    categoryLabel: 'Visual Comfort',
    badgeTone: 'neutral',
    isFreeHabit: true,
    whyYouSeeThis:
      prefs.dailyScreenHours >= 2
        ? `Because you logged ${prefs.dailyScreenHours} hours of daily screen time for ${childName}.`
        : 'Because continuous near work exceeding 45 minutes without a pause causes ocular fatigue.',
    title: 'Take 20-Second Eye Comfort Breaks',
    body: 'Guidelines flag more than 45 minutes of continuous close work without a break as a risk factor. The American Academy of Ophthalmology (AAO) recommends the 20-20-20 rule for digital eye comfort.',
    keyDetails: [
      'The 20-20-20 Rule: Every 20 minutes of close work, look at an object 20 feet away for 20 seconds.',
      'Visual comfort focus: This practice relaxes ciliary muscles and alleviates dry eye symptoms and eye strain (labeled for comfort and strain relief, not as a guaranteed myopia cure).',
      'Zero Cost ($0): Build a quick look-out-the-window break into homework routines.',
    ],
    priority: 70,
  });

  // Habit D: Family History (if parents have myopia)
  if (prefs.myopicParentsCount >= 1) {
    cards.push({
      id: 'family_history',
      category: 'habit',
      categoryLabel: 'Genetic Awareness',
      badgeTone: 'warning',
      whyYouSeeThis:
        prefs.myopicParentsCount === 2
          ? 'Because you logged that both parents wear distance glasses.'
          : 'Because you logged that one parent wears distance glasses.',
      title: 'Earlier Checks Matter with Family Myopia',
      body:
        prefs.myopicParentsCount === 2
          ? 'Clinical research (including the multi-center CLEERE study) indicates that having two myopic parents raises a child’s risk of developing myopia about sevenfold. Genetics accelerate the eye growth timeline, making earlier baseline optometrist visits crucial.'
          : 'Clinical research (including the multi-center CLEERE study) indicates that having one myopic parent roughly triples a child’s risk of developing myopia compared to children with no myopic parents.',
      keyDetails: [
        'Don’t wait for complaints: Young children rarely complain about blurry vision because they assume everyone sees the world that way.',
        'Schedule earlier: An in-person pediatric eye exam before kindergarten or 1st grade establishes an objective refractive baseline.',
      ],
      priority: isFlagged ? 82 : 78,
    });
  }

  // ==========================================
  // JOB 3: HEALTHCARE ACCESS CARDS (YOUR MISSION)
  // ==========================================

  // Access A: Medicaid & CHIP EPSDT Coverage
  cards.push({
    id: 'access_medicaid',
    category: 'access',
    categoryLabel: 'Healthcare Access',
    badgeTone: 'accent',
    whyYouSeeThis:
      'To ensure your family knows your healthcare rights for 100% free pediatric eye exams and corrective eyeglasses.',
    title: 'Medicaid & CHIP Cover Children’s Glasses at $0',
    body: 'Under federal Medicaid law (the EPSDT benefit — Early and Periodic Screening, Diagnostic, and Treatment), all enrolled children under age 21 are legally entitled to comprehensive dilated pediatric eye exams and medically necessary corrective eyeglasses with zero out-of-pocket copay.',
    keyDetails: [
      'What is covered: 100% of comprehensive dilated eye exams by optometrists or ophthalmologists, plus frames and shatter-resistant polycarbonate lenses.',
      'CHIP coverage: Every state’s Children’s Health Insurance Program includes diagnostic vision care and prescription glasses.',
      'How to use: Call the toll-free Member Services number on your child’s health card and ask for in-network pediatric vision providers in your area.',
    ],
    priority: isFlagged ? 88 : 65,
  });

  // Access B: Vision To Learn & School Nonprofits
  cards.push({
    id: 'access_school_nonprofits',
    category: 'access',
    categoryLabel: 'Community Care',
    badgeTone: 'accent',
    whyYouSeeThis:
      'To connect families with verified community programs providing free on-site exams and free glasses.',
    title: 'Free School-Based Optical Clinics: Vision To Learn',
    body: 'Vision To Learn is a national 501(c)(3) nonprofit operating across Title I school districts in over 15 states. Their mobile eye clinics visit schools directly, performing free comprehensive exams and delivering free custom-prescribed glasses to students.',
    keyDetails: [
      'Ask your school nurse: Check if Vision To Learn, mobile health vans, or community screening partners visit your child’s school district.',
      'InfantSEE (infantsee.org): Free comprehensive infant eye assessments by American Optometric Association optometrists for babies 6 to 12 months old.',
      'VSP Eyes of Hope: Provides gift certificates for free exams and glasses through school nurses and local charities for uninsured children in need.',
    ],
    priority: isFlagged ? 84 : 60,
  });

  // Sort descending by priority
  return cards.sort((a, b) => b.priority - a.priority);
}
