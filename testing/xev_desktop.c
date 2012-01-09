/**
 * cc -o memo memo.c -lXm -lXt -lX11 -I/usr/X11R6/include/
 -L/usr/X11R6/lib/
*/


#include <Xm/Xm.h>
#include <X11/X.h>
#include <Xm/Label.h>
#include <X11/Xatom.h>
#include <stdlib.h>
#include <stdio.h>

void main(int argc, char **argv)
{
  Widget shell, msg;
  XtAppContext app;
  XmString xmstr;
  XClientMessageEvent xev;
  Display *display;

  shell = XtAppInitialize(&app, "Memo", NULL, 0, &argc, argv, NULL,
                          NULL, 0);

  xmstr = XmStringCreateLtoR("move window test",
                             XmFONTLIST_DEFAULT_TAG);

  msg =
    XtVaCreateManagedWidget(
      "message", xmLabelWidgetClass, shell, XmNlabelString, xmstr,
      NULL);

  XmStringFree(xmstr);

  XtRealizeWidget(shell);


/* Now move the window to a different area */
  display = XtDisplay(shell);


  xev.type = ClientMessage;
  xev.window = XtWindow(shell);
  xev.message_type = XInternAtom(display, "_NET_WM_DESKTOP", False);
  xev.format = 32;

/* Force into desktop 2 */
  xev.data.l[0] = 2;


  XSendEvent(
    display,
    RootWindowOfScreen(XtScreen(shell)),
    False,
    SubstructureNotifyMask|SubstructureRedirectMask,
    (XEvent *) &xev);


  XtAppMainLoop(app);
}
