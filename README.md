# Overview

ScrapeX provides a node library to scrape basic details of a url using the [metascraper](https://metascraper.js.org/#/) and [node-unfluff](https://github.com/ageitgey/node-unfluff) libraries.

# Getting Started

## Install

Install

```javascript
npm i scrapex --save or yarn add scrapex
```

## Usage

```javascript
import { scrape } from 'scrapex';
// or
const { scrape } = require('scrapex');
```

```javascript
// define a url
const url = "https://appleinsider.com/articles/19/08/22/like-apple-music-spotify-now-offers-a-three-month-premium-trial"
const data = await scrape(url, lazy=true)

console.log(data)

{ 
    audio: null,
    author: 'AppleInsider',
    logo: 'https://logo.clearbit.com/appleinsider.com',
    favicon:
    'https://photos5.appleinsider.com/v9/images/apple-touch-icon-72.png',
    image:
    'https://photos5.appleinsider.com/gallery/32489-55660-header-xl.jpg',
    publisher: 'AppleInsider',
    date: '2019-08-22T12:14:35.000Z',
    description:
    'Spotify has extended the free-trial period it offers for Spotify Premium from one month to three, the default length of Apple\'s free trial for Apple Music.',
    lang: 'en',
    title:
    'Like Apple Music, Spotify now offers a three month premium trial',
    url:
    'https://appleinsider.com/articles/19/08/22/like-apple-music-spotify-now-offers-a-three-month-premium-trial',
    text:
    'By Amber Neely\n\nThursday, August 22, 2019, 05:14 am PT (08:14 am ET)\n\nSpotify has extended the free-trial period it offers for Spotify Premium from one month to three, the default length of Apple\'s free trial for Apple Music.\n\nStreaming giant Spotify is now offering three free months to anyone who has yet to try their service, according to a news post on their site.\n\n"Beginning August 22, eligible users will receive the first three months on us for free when they sign up for any Spotify Premium plan," says Spotify in a statement about the new trial. "You\'ll unlock a world of on-demand access to millions of hours of audio content—no matter when you sign up, winter, spring, summer, or fall."\n\nThe trial period currently only extends to individual and student plans and will roll out across Duo and Family in the coming months. The trial doesn\'t extend to Headspace or anyone who is billed directly through their carrier, with the exception of those in Japan, Australia, China, and Germany.\n\nApple has been offering free three-month trials to Apple Music since it\'s inception, though they may begin limiting their trial to one month. Apple had learned artists are wary of lengthy trial periods when Taylor Swift protested the three-month trial by withholding her album 1989 from the service. The protest earned artists the ability to be paid for track and album streams through the free trial period.\n\nStudents who sign up for Apple Music can get a free six-month trial by visiting Apple\'s Support Page. After the trial ends, students pay $4.99 a month to continue their subscription until graduation, which works out to be about half the price of a standard subscription.\n\nLike most other paid music subscriptions, Spotify Premium offers users the ability to listen ad-free, download music to their device, create playlists, skip tracks, and toggle between devices when listening.',
    tags: [ 'Podcast', 'Spotify,', 'Apple Music' ],
    links:
    [
        { text: 'a news post on their site.',
        href:
        'https://newsroom.spotify.com/2019-08-22/5-ways-to-take-control-of-your-streaming-with-spotify-premium/' },
        { text: 'one month.',
        href:
        'https://appleinsider.com/articles/19/07/25/apple-begins-limiting-apple-music-free-trial-period-to-one-month' },
        { text: 'Taylor Swift protested the three-month trial',
        href:
        'https://appleinsider.com/articles/15/06/18/apple-music-to-miss-out-on-taylor-swifts-1989-album' },
        { text: 'by visiting Apple&apos;s Support Page.',
        href: 'https://support.apple.com/en-ke/HT205928' },
        { text: 'about half the price of a standard subscription.',
        href:
        'https://appleinsider.com/articles/16/05/06/apple-begins-offering-half-price-499-apple-music-subscriptions-for-students' } 
    ],
    content:
    '<div><div><div><div> <p>\n\t\t\tBy <a href="undefined/cdn-cgi/l/email-protection#d6b7bbb4b3a496b7a6a6bab3bfb8a5bfb2b3a4f8b5b9bb">Amber Neely</a>\t\t\t<br />\n\t\t\tThursday, August 22, 2019, 05:14 am PT (08:14 am ET)\n\t\t</p>Spotify has extended the free-trial period it offers for Spotify Premium from one month to three, the default length of Apple\'s free trial for Apple Music.<br /><p>\nStreaming giant Spotify is now offering three free months to anyone who has yet to try their service, according to <a href="https://newsroom.spotify.com/2019-08-22/5-ways-to-take-control-of-your-streaming-with-spotify-premium/">a news post on their site.</a></p><p>\n"Beginning August 22, eligible users will receive the first three months on us for free when they sign up for any Spotify Premium plan," says Spotify in a statement about the new trial. "You\'ll unlock a world of on-demand access to millions of hours of audio content—no matter when you sign up, winter, spring, summer, or fall."</p><p>\nThe trial period currently only extends to individual and student plans and will roll out across Duo and Family in the coming months. The trial doesn\'t extend to Headspace or anyone who is billed directly through their carrier, with the exception of those in Japan, Australia, China, and Germany. </p><p>\nApple has been offering free three-month trials to Apple Music since it\'s inception, though they may begin limiting their trial to <a href="https://appleinsider.com/articles/19/07/25/apple-begins-limiting-apple-music-free-trial-period-to-one-month">one month.</a> Apple had learned artists are wary of lengthy trial periods when <a href="https://appleinsider.com/articles/15/06/18/apple-music-to-miss-out-on-taylor-swifts-1989-album">Taylor Swift protested the three-month trial</a> by withholding her album <em>1989</em> from the service. The protest earned artists the ability to be paid for track and album streams through the free trial period.</p><p>\nStudents who sign up for Apple Music can get a free six-month trial <a href="https://support.apple.com/en-ke/HT205928">by visiting Apple\'s Support Page.</a> After the trial ends, students pay $4.99 a month to continue their subscription until graduation, which works out to be <a href="https://appleinsider.com/articles/16/05/06/apple-begins-offering-half-price-499-apple-music-subscriptions-for-students">about half the price of a standard subscription.</a></p><p>\nLike most other paid music subscriptions, Spotify Premium offers users the ability to listen ad-free, download music to their device, create playlists, skip tracks, and toggle between devices when listening. </p></div></div></div></div>'
}

```

### Extracted data elements

This is what `scrapex` will try to grab from a web page:

- `audio` — eg. https://cf-media.sndcdn.com/U78RIfDPV6ok.128.mp3. A audio URL that best represents the article.
- `title` - The document's title (from the &lt;title&gt; tag)
- `date` - The document's publication date
- `copyright` - The document's copyright line, if present
- `author` - The document's author
- `publisher` - The document's publisher (website name)
- `text` - The main text of the document with all the junk thrown away
- `image` - The main image for the document (what's used by facebook, etc.)
- `videos` - An array of videos that were embedded in the article. Each video has src, width and height.
- `tags`- Any tags or keywords that could be found by checking &lt;rel&gt; tags or by looking at href urls.
- `lang` - The language of the document, either detected or supplied by you.
- `description` - The description of the document, from &lt;meta&gt; tags
- `favicon` - The url of the document's [favicon](http://en.wikipedia.org/wiki/Favicon).
- `links` - An array of links embedded within the article text. (text and href for each)
- `logo` — eg. https://entrepreneur.com/favicon180x180.png. An image URL that best represents the publisher brand.
- `content` — readability view html of the article.
- `text` — clear text of the readable html.

# Todo

# Contributors

<img width=150px src="https://pbs.twimg.com/profile_images/1028292150205661185/TFP8E8Fc_400x400.jpg">
<p><strong>Rakesh Paul</strong> - <a href="https://xtrios.com">Xtrios</a></p>

# License

This project is licensed under the MIT License.
