# Kenvi & Puru — Reception Invitation

An animated, hand-painted invitation to the **reception** of **Kenvi Dwivedi & Puru Tyagi**
on **Saturday, 28 November 2026** at **Hotel Royal Residency, Saharanpur**.

## See it

**Open the invitation: <https://allbotixtech-byte.github.io/Wedding/>**
Tap the wax seal to start, with the sound on. It works on phones and on computers.

The same invitation as a video (59.5 seconds, with music):

| Video | Best for |
|---|---|
| [Vertical, 1080 × 1920](https://allbotixtech-byte.github.io/Wedding/reception-invitation/output/reception-invitation-vertical-1080x1920.mp4) | Phones, Instagram stories, WhatsApp status |
| [Vertical, small file](https://allbotixtech-byte.github.io/Wedding/reception-invitation/output/reception-invitation-whatsapp-720x1280.mp4) | Sending in WhatsApp chats |
| [Horizontal, 1920 × 1080](https://allbotixtech-byte.github.io/Wedding/reception-invitation/output/reception-invitation-horizontal-1920x1080.mp4) | TVs, laptops, projectors |

## Run it on your own computer

You need [Node.js](https://nodejs.org). Open a terminal in this folder and type:

```
npm run dev
```

The invitation opens in your browser. Stop it with `Ctrl + C`.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the invitation on your computer and opens it in the browser. |
| `npm run build` | Collects just the website files into `reception-invitation/dist/`. |
| `npm run setup` | One-time install of the video renderer (also needs FFmpeg). |
| `npm run render` | Renders the vertical video again, about 5 minutes. |

Everything else is explained in **[reception-invitation/README.md](reception-invitation/README.md)**: changing the
names, date, venue or wording, replacing the illustrations or the music, and rendering the videos.

## What is in this repository

| Path | What it is |
|---|---|
| `reception-invitation/` | The invitation: the website, the video renderer and the finished videos. |
| `index.html` | Forwards the home page of the site to the invitation. |
| `package.json` | Lets the `npm` commands above work from this folder. |
| `WhatsApp Image … .jpeg` | The three original illustrations of the couple. |
