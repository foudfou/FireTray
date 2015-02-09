#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <unistd.h>
#include <err.h>

#include <X11/Xlib.h>

int
main(int argc, char **argv)
{
	Display *dpy;
	Window window;
	Atom atom;

	if (argc < 2) {
		fprintf(stderr, "usage: xgetselectionowner <selection_name>\n");
		exit(1);
	}

	dpy = XOpenDisplay(NULL);
	if (dpy == NULL)
		errx(1, "failed to open X display");

	atom = XInternAtom(dpy, argv[1], False);
	printf("atom=%i, display=%p\n", atom, (void *) dpy);
	window = XGetSelectionOwner(dpy, atom);

	printf("window=%p\n", (void *) window);

	XCloseDisplay(dpy);

	return 0;
}
