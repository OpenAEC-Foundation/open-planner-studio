# Giving feedback

Goal: report an error or pass on an idea, optionally with a screenshot, directly from the app.

## When you need this

The schedule calculates something you do not understand, a button does not do what it should, or you miss something in the app. A good report helps the makers find the problem. That is why the app itself puts the version, the operating system and the language in your report. What you describe yourself decides whether they can do something with it: what you did, what you expected and what happened.

## Steps

1. Click the button *Give feedback* at the top of the window. That button is always in the title bar. Its text changes every ten minutes: *Give feedback*, *Report a bug* and *Add a new feature*. It is always the same button. The window *Send feedback* opens.
2. Choose the kind of report. *Something's not working* is for an error: something does not do what it should. *Idea* is for something you miss or want to be different. *Question or comment* is for the rest. *Something's not working* is selected by default.
3. Fill in the *Title* and then the *Description*. The empty fields show an example: a title such as *E.g. Critical path jumps after saving*, and for the description the question *What did you do, what did you expect, and what happened?* As long as the button *Send* is grey, a grey line next to it says why, for example *Enter a title.* or that you write at least 10 characters in the title and description together.
4. If you want a reply, fill in your *Email address*. That field is optional. The app remembers the address after a successful report, so it is already there next time.
5. If you want to show something, turn on *Attach screenshot*. The app then makes a picture of the app without this window. A moment later you see a small preview with three buttons next to it: *Annotate*, *Retake* and *Remove*.
6. *Annotate* opens an editor. In it you put arrows, rectangles, freehand lines and text on the picture. With *Cover* you draw a black area over something that must not go along, such as a name or an amount. That part is then really gone from the picture the app sends. You choose the color, take back your last action with *Undo* or start over with *Clear all*. Click *Done* to keep your changes, or *Cancel* (or Esc) to throw them away.
7. *Retake* makes a new screenshot and clears your annotations. *Remove* removes the screenshot and turns the checkbox off.
8. Look at the grey line *Sent along* under the form. It shows what the app sends along itself: the version, the operating system and the language, for example *Sent along: v2026.10.1 · Windows · English*.
9. Click *Send*. While sending, the button says *Sending…*.
10. You see *Thank you, your report has been sent.* If an issue on GitHub was made for your report, there is also the button *View on GitHub*. Click *Close*.

## Where your report goes

The app sends your report to Open Feedback Studio by OpenAEC. You do not need an account for that, also not on GitHub. The makers see your report in their overview. If the app is linked to GitHub there, Open Feedback Studio also turns it into a public issue on GitHub. With *Something's not working* the issue gets the label *bug*, with *Idea* the label *enhancement*. Under your description there is then a line with the version of Open Planner Studio, your operating system and the language of the app.

## Pitfalls and what the app does then

**Your report can become public.** Do not put anything in it that you do not want to share. That also goes for the screenshot: the picture shows everything that is visible in the app at that moment, such as task names and resources of your project. The app makes the screenshot at the moment you turn on *Attach screenshot*. If the screen is not right yet, close the window, set the screen right, open the window again and click *Retake*. Use *Cover* to hide what you do not want to show.

**The screenshot is too large.** The app makes the screenshot smaller before sending. If it is still too large after that, your report goes without a picture. The thank-you screen then says *The screenshot was too large and was not sent.*

**Sending does not work.** A message appears in the window and your text stays. There are four cases:

- *The report was not accepted.* Check the text and the email address. A report that is mostly links is refused.
- *You have sent many reports in a short time.* Try again in an hour.
- *Sending failed.* There is no connection or the server does not answer. Try again, or click *Open on GitHub*. That button is not there if an earlier attempt was uncertain (see below).
- *We are not sure whether your report arrived. Wait a minute and then send it again; if it is already there, we will see that automatically.* The connection dropped after the app had sent your report. Your text stays. There is no button *Open on GitHub*, because your report can still come in. That stays so until your report is sent or already received, also if you close the window in between and open it again.

**Your report is already received.** If you send a report that is already there, the form stays with this above it: *We have already received this report. Want to add something? Then change the text and send it again.* Your text stays and your email address is remembered. Click *Close* if you do not want to add anything; the form is empty next time. If you type something more, the message disappears and you can send again; the button is then called *Save and close* again and your text is kept.

**Open on GitHub.** This is the route without Open Feedback Studio. For this you do need an account on GitHub. Without a screenshot the GitHub page on which you create a new issue opens straight away in your browser, with your title and description already filled in. With a screenshot you first see *Almost done — your screenshot is on the clipboard.* with four steps. Click *OK, go to GitHub*, click inside the large text area of the issue page and press Ctrl+V (Cmd+V on a Mac). Then click *Submit new issue* at the bottom. Only then is your report sent.

**Pasting does not work.** On the GitHub route the screenshot is also saved as a file on your computer. In the desktop app the window mentions the path: *Can't paste? We also saved the screenshot to* that path *— drag that file into the text area.* In the browser the app downloads the picture as `feedback-` with a number and the extension `.png`. You find it in your downloads folder and drag it into the text area.

**The screenshot fails.** It says *Screenshot capture failed. You can still send feedback without a screenshot.* The checkbox goes off and you can send your report without a picture.

**You close the window before you send.** If there is something in the form, the button at the bottom is called *Save and close*; with an empty form it is called *Close*. *Save and close*, the cross and Esc close the window, and your report is kept as a draft until you send it or click *Clear*. When you open the window again, the kind, your text, the email address and the screenshot with annotations are still there. The draft is kept as long as the app is open; after you quit the app it is gone. After a successful report the form is empty again. If you want to start over yourself, click *Clear* at the bottom left. A click beside the window does not close it. While sending, Esc does not close the window.

## See also

- [Updating the app](docs://howto-app-bijwerken): before a report, check whether you have the latest version.
