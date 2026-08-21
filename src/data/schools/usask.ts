import type { School } from './types.ts'
import { programs } from '../programs/index.ts'

// Real, verified USask scholarships and resources only — never invented or placeholder entries.
//
// Sources (2026-08-18):
// - students.usask.ca/money/awards/undergraduate-awards.php ("Featured awards" — university-wide)
// - paws2.usask.ca/compsci/awards.php (CS department page — names only, no deadlines/values listed there)
//
// Deadlines given without an explicit year are recorded as text only (no deadlineDate) rather than
// guessing a year — see RCAF below for the one entry where the source did give a full date.
export const usask: School = {
  id: 'usask',
  name: 'University of Saskatchewan',
  aliases: ['usask', 'u of s', 'university of saskatchewan'],
  programs,
  resources: [
    // --- University-wide (open to any continuing undergrad, not CS-specific) ---
    {
      id: 'rhodes-scholarship',
      url: 'https://students.usask.ca/money/awards/undergraduate-awards.php?award=EX0133C',
      name: 'Rhodes Scholarships',
      value: 'Varies',
      deadline: 'August 17 (annual)',
      whatItIs:
        "Postgraduate scholarship to study at the University of Oxford — featured on USask's undergraduate awards search.",
      whyRelevant: 'Open to any continuing USask undergrad, not restricted by program.',
    },
    {
      id: 'bates-extended-practicum',
      url: 'https://students.usask.ca/money/awards/undergraduate-awards.php?award=300042CS01',
      name: 'Bates Award for Excellence in Extended Practicum',
      value: 'Not applicable (non-monetary)',
      deadline: 'First business day of February (Fall practicum) or last business day of April (Winter practicum)',
      whatItIs: 'Recognizes excellence for students completing an extended practicum placement.',
      whyRelevant: 'Only relevant if your program includes an extended practicum — worth checking if CS co-op terms qualify.',
    },
    {
      id: 'mccreath-aboriginal-student-award',
      url: 'https://students.usask.ca/money/awards/undergraduate-awards.php?award=301690CB01',
      name: 'McCreath Aboriginal Student Award',
      value: '$10,000',
      deadline: 'Not listed on the award search — check the award page directly',
      whatItIs: 'A $10,000 award for Aboriginal students, featured on USask’s undergraduate awards search.',
      whyRelevant: 'High value with no deadline shown here — worth confirming directly given the size.',
    },
    {
      id: 'cfuw-saskatoon-scholarship',
      url: 'https://students.usask.ca/money/awards/undergraduate-awards.php?award=EX0029C',
      name: 'Canadian Federation of University Women (CFUW) Saskatoon Inc. Scholarships',
      value: '$2,500',
      deadline: 'May 31 (annual)',
      whatItIs: 'A $2,500 scholarship from the Saskatoon chapter of the Canadian Federation of University Women.',
      whyRelevant: 'Community-funded — smaller applicant pool than a university-wide award.',
    },
    {
      id: '3m-national-student-fellowship',
      url: 'https://students.usask.ca/money/awards/undergraduate-awards.php?award=EX0365C',
      name: '3M National Student Fellowship',
      value: '$2,000 plus conference recognition (per USask listing)',
      deadline: 'November 15 (annual)',
      whatItIs:
        "Listed on USask's undergraduate awards search with recognition through the Society for Teaching and Learning in Higher Education (STLHE) plus a $2,000 discretionary award.",
      whyRelevant:
        "USask's listing pairs this with teaching-recognition language that reads unusually for a student award — worth double-checking the award page before assuming eligibility.",
    },
    {
      id: 'orano-northern-saskatchewan-scholarship',
      url: 'https://students.usask.ca/money/awards/undergraduate-awards.php?award=EX0009C',
      name: 'Orano Northern Saskatchewan Scholarship Program',
      value: '$4,000',
      deadline: 'July 31 (annual)',
      whatItIs: 'A $4,000 scholarship program for students connected to Northern Saskatchewan.',
      whyRelevant: 'Geographic eligibility narrows the applicant pool significantly.',
    },
    {
      id: 'saskatchewan-youth-from-care-bursary',
      url: 'https://students.usask.ca/money/awards/undergraduate-awards.php?award=302257CS01',
      name: 'Saskatchewan Youth from Care Bursary',
      value: 'Full tuition & fees + living costs + books + $1,000 first-year support',
      deadline: 'Open until June 1',
      whatItIs:
        'Covers tuition, fees, living costs, books, and an extra $1,000 in year one for students who were formerly in government care.',
      whyRelevant: 'One of the highest-value awards here — covers most of a term’s real cost, not a token amount.',
    },
    {
      id: 'mccall-macbain-scholarship',
      url: 'https://students.usask.ca/money/awards/undergraduate-awards.php?award=EX0378C',
      name: 'McCall MacBain Scholarship',
      value: 'Not listed',
      deadline: 'September 21 (annual)',
      whatItIs: "Featured on USask's undergraduate awards search; value not listed there.",
      whyRelevant: 'A well-known national scholarship program — worth checking the award page for full details.',
    },
    {
      id: 'rcaf-foundation-student-scholarships',
      url: 'https://students.usask.ca/money/awards/undergraduate-awards.php?award=EX0382C',
      name: 'RCAF Foundation Student Scholarships',
      value: '$1,000',
      deadline: 'May 20, 2026',
      deadlineDate: '2026-05-20',
      whatItIs: 'A $1,000 scholarship from the Royal Canadian Air Force Foundation, featured on USask’s undergraduate awards search.',
      whyRelevant: 'External/national award — separate applicant pool from USask-only scholarships.',
    },

    // --- Computer Science department (paws2.usask.ca/compsci/awards.php) ---
    // The department page lists names only — no deadlines or values. Real awards, thin metadata.
    {
      id: 'cs-alumni-award',
      url: 'https://paws2.usask.ca/compsci/awards.php',
      name: 'Alumni Award',
      deadline: 'Not listed — check the CS department awards page',
      whatItIs: 'Computer Science department award for undergraduate students.',
      whyRelevant: 'Administered directly by the CS department — far smaller applicant pool than university-wide scholarships.',
    },
    {
      id: 'bhupinder-kaur-basran-memorial-scholarship',
      url: 'https://paws2.usask.ca/compsci/awards.php',
      name: 'Bhupinder Kaur Basran Memorial Scholarship',
      deadline: 'Not listed — check the CS department awards page',
      whatItIs: 'Computer Science department award for undergraduate students.',
      whyRelevant: 'CS-department-specific — narrower pool than university-wide scholarships.',
    },
    {
      id: 'jp-tremblay-award',
      url: 'https://paws2.usask.ca/compsci/awards.php',
      name: 'J. P. Tremblay Award',
      deadline: 'Not listed — check the CS department awards page',
      whatItIs: 'Computer Science department award for undergraduate students.',
      whyRelevant: 'CS-department-specific — narrower pool than university-wide scholarships.',
    },
    {
      id: 'calian-advanced-technologies-scholarships',
      url: 'https://paws2.usask.ca/compsci/awards.php',
      name: 'Calian, Advanced Technologies Scholarships',
      deadline: 'Not listed — check the CS department awards page',
      whatItIs: 'Computer Science department award for undergraduate students, sponsored by Calian.',
      whyRelevant: 'Industry-sponsored — narrower pool than university-wide scholarships.',
    },
    {
      id: 'linda-carmichael-recognition-award',
      url: 'https://paws2.usask.ca/compsci/awards.php',
      name: 'Linda Carmichael Recognition Award for Women in Computational Sciences',
      deadline: 'Not listed — check the CS department awards page',
      whatItIs: 'Computer Science department award recognizing women in computational sciences.',
      whyRelevant: 'CS-department-specific — narrower pool than university-wide scholarships.',
    },
    {
      id: 'james-e-greer-undergraduate-research-prize',
      url: 'https://paws2.usask.ca/compsci/awards.php',
      name: 'James E. Greer Teaching, Learning, and Technology Undergraduate Research Prize',
      deadline: 'Not listed — check the CS department awards page',
      whatItIs: 'Computer Science department research prize for undergraduate students.',
      whyRelevant: 'CS-department-specific — narrower pool than university-wide scholarships.',
    },
    {
      id: 'rick-bunt-prize-computer-systems',
      url: 'https://paws2.usask.ca/compsci/awards.php',
      name: 'Dr. Rick Bunt Prize in Computer Systems',
      deadline: 'Not listed — check the CS department awards page',
      whatItIs: 'Computer Science department prize in computer systems.',
      whyRelevant: 'CS-department-specific — narrower pool than university-wide scholarships.',
    },
    {
      id: 'debra-lawrence-scholarship',
      url: 'https://paws2.usask.ca/compsci/awards.php',
      name: 'The Debra Lawrence Scholarship',
      deadline: 'Not listed — check the CS department awards page',
      whatItIs: 'Computer Science department award for undergraduate students.',
      whyRelevant: 'CS-department-specific — narrower pool than university-wide scholarships.',
    },
    {
      id: 'rahat-yasir-award-diversity-inclusion',
      url: 'https://paws2.usask.ca/compsci/awards.php',
      name: 'Rahat Yasir Award for Diversity and Inclusion',
      deadline: 'Not listed — check the CS department awards page',
      whatItIs: 'Computer Science department award recognizing diversity and inclusion.',
      whyRelevant: 'CS-department-specific — narrower pool than university-wide scholarships.',
    },
    {
      id: 'nserc-departmental-usra',
      url: 'https://paws2.usask.ca/compsci/awards.php',
      name: 'NSERC and Departmental Undergraduate Student Research Awards (USRA)',
      deadline: 'Not listed — check the CS department awards page',
      whatItIs: 'Funded undergraduate research award combining NSERC and CS department funding.',
      whyRelevant: 'A paid research opportunity, not just a scholarship — worth it even outside financial need.',
    },
  ],
}
