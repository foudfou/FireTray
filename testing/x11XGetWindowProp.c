/*
    Compiled as:
    gcc -Wall x11XGetWindowProp.c -o x11XGetWindowProp -lm -lXext -lX11
*/
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/Xatom.h>

int main(void)
{
	int screen, idx, stride;
	int X, Y, W, H;
	Atom actual;
	unsigned long count, remaining;
	int format = 32;
	int request_size = 4 * sizeof(long);
	unsigned char *xywh;
	Display *d = XOpenDisplay(0);

	if (!d) printf("Can't open display: %s",XDisplayName(0));
	Atom _NET_WORKAREA = XInternAtom(d, "_NET_WORKAREA", 0);
	screen = DefaultScreen(d);

	/* Find the total screen size (assume X = Y = 0)*/
	W = DisplayWidth(d, screen);
	H = DisplayHeight(d, screen);
	printf("Display Area: W: %d, H: %d\n", W, H);
	
	/* New query the server to find the usable screen size */
	if (XGetWindowProperty(d, RootWindow(d, screen),
	_NET_WORKAREA, 0, request_size, False,
	XA_CARDINAL, &actual, &format, &count, &remaining, &xywh) || !xywh)
	{
		printf("Get workarea failed\n");
	}
	else
	{
		printf("Got workarea OK\n");
		printf("format: %d, count: %ld, remaining: %ld\n", format, count, remaining);
		/* How many bytes per sample? */
		stride = format / 8;
		X = *(int*)&xywh[0];
		Y = *(int*)&xywh[stride];
		W = *(int*)&xywh[stride * 2];
		H = *(int*)&xywh[stride * 3];
		
		/* Now print out the raw xywh byte array for checking */
		for(idx = 0; idx < request_size; idx++)
		{
			printf("%02X ", xywh[idx]);
			if(!((idx +1)%8)) puts(" ");
		}
		/* release the xywh resources */
		XFree(xywh);
		printf("Usable Area: X: %d, Y: %d   W: %d, H: %d\n", X, Y, W, H);
	}
	return 0;
}

/* End of File */
