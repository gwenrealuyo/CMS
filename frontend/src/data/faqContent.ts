export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type FaqCategory = {
  id: string;
  title: string;
  items: FaqItem[];
};

/** Curated end-user FAQs from USER_GUIDE and ACCESS_LEVELS_GUIDE. */
export const faqCategories: FaqCategory[] = [
  {
    id: "sign-in",
    title: "Sign in & account",
    items: [
      {
        id: "how-sign-in",
        question: "How do I sign in?",
        answer:
          "Open The Lighthouse in your browser, go to the Login page, enter your username and password, then click Sign in. If this is your first login with a temporary password, you will be asked to change your password before continuing.",
      },
      {
        id: "forgot-password",
        question: "I forgot my password. What should I do?",
        answer:
          "On the login page, click Forgot password and follow the instructions to contact an administrator. An admin can reset your password from your profile or from Admin Settings → Password Resets.",
      },
      {
        id: "my-record",
        question: "Where can I see my own profile and Journey?",
        answer:
          "Open My record from the profile menu (top right). You will see your full profile and Journey timeline. Use Account settings (/profile) to update your name, email, photo, and password.",
      },
      {
        id: "visitors-login",
        question: "Can Visitors log in?",
        answer:
          "No. Visitor is a guest record only — staff track visitors in the directory, but Visitors cannot sign in to the app.",
      },
    ],
  },
  {
    id: "access",
    title: "Access & menus",
    items: [
      {
        id: "module-missing",
        question: "Why is a module missing from the sidebar?",
        answer:
          "Your administrator may have disabled that module, or you may not have access to it. Ask an admin to check Admin Settings → Module Controls and your role or module assignments.",
      },
      {
        id: "roles-vs-assignments",
        question: "What is the difference between my role and module assignments?",
        answer:
          "Your base role (Admin, Pastor, or Member) is set on your account. Module assignments are optional extras that grant coordinator, teacher, reporter, or bible-sharer access within a specific module (for example Cluster → Coordinator). Access from all your assignments is combined.",
      },
      {
        id: "branch-locked",
        question: "Why is my branch filter locked?",
        answer:
          "Some roles can only view their own branch’s data. Admins, HQ Pastors, and HQ Senior Coordinators can see across branches; most other users stay scoped to their campus.",
      },
      {
        id: "stats-hidden",
        question: "Why don’t I see summary stats or Analytics?",
        answer:
          "Summary stats in some modules are limited to coordinators, pastors, and admins. Analytics is available to Admins and Pastors only.",
      },
    ],
  },
  {
    id: "people",
    title: "People & families",
    items: [
      {
        id: "who-can-edit",
        question: "Who can add or edit people?",
        answer:
          "Admins and Pastors can add and edit people in their scope. Module coordinators can also add and edit people in their scope. Plain Members (with no coordinator assignment) can add Visitors only, and view themselves and their family.",
      },
      {
        id: "see-only-self",
        question: "Why do I only see myself or my family in People?",
        answer:
          "Plain Members without module assignments typically see only themselves and their family. If you need a wider directory view, ask an administrator to add a module assignment.",
      },
      {
        id: "what-is-journey",
        question: "What is Journey?",
        answer:
          "Journey is the timeline on a person’s profile. It shows spiritual milestones and activity such as baptism, cluster attendance, lessons, events, and notes.",
      },
      {
        id: "families",
        question: "How do families work?",
        answer:
          "Use People → Families to create a household, assign a family leader, add members, and optionally link the family to a cluster. You can also see people who are not yet in a family from the unassigned list.",
      },
    ],
  },
  {
    id: "clusters",
    title: "Clusters",
    items: [
      {
        id: "submit-report",
        question: "How do I submit a weekly cluster report?",
        answer:
          "Go to Clusters, or use Dashboard → Submit Report or + → Submit Cluster Report. Select your cluster, enter the meeting date, gathering type (Physical / Online / Hybrid), and attendance. Add activities, prayer requests, and other notes as needed, then save. Attendance is reflected on each person’s Journey.",
      },
      {
        id: "cannot-submit",
        question: "Why can’t I submit a cluster report?",
        answer:
          "You need a Cluster module assignment for that cluster (for example Coordinator or Reporter). Regular members can view their own cluster in read-only mode but cannot submit reports unless they have an assignment.",
      },
      {
        id: "cluster-tabs",
        question: "What are the Clusters tabs for?",
        answer:
          "Clusters shows group details (members, families, coordinator, schedule). Reports lists submitted weekly reports. Compliance is an oversight view for senior cluster coordinators.",
      },
    ],
  },
  {
    id: "other-modules",
    title: "Other modules",
    items: [
      {
        id: "evangelism",
        question: "What can I do in Evangelism?",
        answer:
          "Evangelism covers Bible study groups, visitor follow-up, and conversion tracking. Coordinators manage groups and prospects, record baptisms and Holy Ghost reception, and submit weekly evangelism reports. Use + → Submit Evangelism Report when available for your role.",
      },
      {
        id: "lessons",
        question: "What is Lessons (NCC)?",
        answer:
          "Lessons is the seven-lesson New Converts Course. Teachers and coordinators assign lessons, log session reports, and track commitment forms. Progress moves from Assigned → In Progress → Completed.",
      },
      {
        id: "sunday-school",
        question: "What is Sunday School for?",
        answer:
          "Sunday School manages classes by age category, enrollment, sessions, and attendance. Teachers see their classes; coordinators see broader class lists and summary stats.",
      },
      {
        id: "events-ministries",
        question: "How do Events and Ministries work?",
        answer:
          "Events is the church calendar — browse calendar or list views, create events (if you have access), and take attendance on occurrences. Ministries lists serving teams by category; coordinators can create and update ministry records.",
      },
      {
        id: "finance",
        question: "Who can use Finance?",
        answer:
          "Finance (donations, offerings, pledges) is available to Admins and Pastors, and to finance module coordinators where that module is enabled. Members without finance access will not see it in the sidebar.",
      },
    ],
  },
  {
    id: "more-help",
    title: "Getting more help",
    items: [
      {
        id: "admin-help",
        question: "Who do I contact for account or access problems?",
        answer:
          "Account creation, password resets, and module assignments are handled by Administrators. For technical issues (site down, login errors), contact your church’s system administrator.",
      },
      {
        id: "search-quick-actions",
        question: "How do search and the + menu work?",
        answer:
          "The top search bar finds people, families, clusters, events, ministries, evangelism groups, Sunday School classes, and prospects. The + menu offers quick actions (Add Visitor, Submit Report, Create Event, and more) based on your role.",
      },
      {
        id: "notifications",
        question: "What are the bell notifications?",
        answer:
          "The bell icon shows alerts such as overdue cluster or evangelism reports, password reset requests (for admins), follow-up reminders, and recent activity confirmations.",
      },
    ],
  },
];
