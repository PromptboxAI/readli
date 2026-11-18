/** One-page printable guides, at /help/print/<slug>, linked from invitations and Kids Mode. */
export interface Handout {
  slug: string;
  title: string;
  intro: string;
  steps: { title: string; body: string }[];
  footer: string;
}

export const HANDOUTS: Handout[] = [
  {
    slug: "record-your-voice",
    title: "How to record your voice for Readli",
    intro: "Your family wants to hear you read them stories. Recording takes just a few minutes, and it's free.",
    steps: [
      {
        title: "Open your invitation",
        body: "Open the invitation link your family sent you, on a phone, tablet or computer. You'll make a free Readli Voice account. You never pay anything.",
      },
      {
        title: "Find a quiet room",
        body: "A bedroom with soft things in it is best. Kitchens and bathrooms echo. Turn off the TV, music and fans, and make sure nobody else is talking.",
      },
      {
        title: "Hold the phone steady",
        body: "Keep the phone or microphone about a hand's width from your mouth, at the same distance the whole time. If the level flashes red, move back a little.",
      },
      {
        title: "Read the story aloud",
        body: "Readli shows a short story on the screen. Read it the way you would at bedtime: warm, with natural pauses, in your own voice. Skip funny voices and accents. It takes 1 to 2 minutes.",
      },
      {
        title: "Share it with your family",
        body: "When your voice is ready, choose to share it with your family. You stay in control: you can stop sharing or delete your voice at any time.",
      },
    ],
    footer: "Stuck? Ask the family member who invited you, or record again somewhere quieter.",
  },
  {
    slug: "set-up-readli-kids",
    title: "Setting up Readli Kids on a tablet",
    intro: "Readli Kids is a bookshelf just for your children, with only the stories and storytellers you've chosen.",
    steps: [
      {
        title: "Set a family PIN",
        body: "Sign in to Readli and go to Settings, then Kids Mode. Set a family PIN first, so a grown-up can leave Readli Kids later.",
      },
      {
        title: "Start Readli Kids on the tablet",
        body: "On the tablet, open Kids Mode, choose which kids use it, give it a name like Family iPad, and tap Start Readli Kids here.",
      },
      {
        title: "Add it to the home screen",
        body: "On an iPad or iPhone, tap Share, then Add to Home Screen. On Android or Fire, open the browser menu and choose Add to Home screen or Install app.",
      },
      {
        title: "Let your kids pick a story",
        body: "The Readli Kids icon opens straight to the bookshelf. Your child taps their name, picks a story and a storyteller, and presses Play. The moon button sets a sleep timer.",
      },
      {
        title: "Leaving Readli Kids",
        body: "The tablet stays in Readli Kids until a grown-up enters the PIN, or you end it from Kids Mode on another device.",
      },
    ],
    footer: "Choose which storytellers each child can hear from your Kids profiles in Readli.",
  },
];

export function getHandout(slug: string): Handout | undefined {
  return HANDOUTS.find((h) => h.slug === slug);
}
