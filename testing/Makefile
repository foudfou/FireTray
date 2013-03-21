includes_gtk := $(shell pkg-config --libs --cflags gtk+-2.0)
includes_gdk_gtk := $(shell pkg-config --libs --cflags gdk-2.0 gtk+-2.0)
executables :=  gtk_icon_example trayicon hide xtypes x11XGetWindowProp \
	window_state_event xev_desktop teststatusicon gtk-version

.PHONY: all
all: $(executables)

.PHONY: clean
clean:
	rm $(executables)

gtk_icon_example: gtk_icon_example.c
	gcc $(includes_gtk) -o gtk_icon_example gtk_icon_example.c

trayicon: trayicon.c
	gcc $(includes_gtk) -o trayicon trayicon.c

hide: hide.c
	gcc $(includes_gtk) -o hide hide.c

xtypes: xtypes.c
	gcc $(includes_gtk) -o xtypes xtypes.c

x11XGetWindowProp: x11XGetWindowProp.c
	gcc -Wall x11XGetWindowProp.c -o x11XGetWindowProp -lm -lXext -lX11

window_state_event: window_state_event.c
	gcc $(includes_gtk) -o window_state_event window_state_event.c

xev_desktop: xev_desktop.c
	gcc -lXm -lXt -lX11 -o xev_desktop xev_desktop.c

teststatusicon: teststatusicon.c prop-editor.c
	gcc $(includes_gtk) -o teststatusicon teststatusicon.c prop-editor.c

gtk-version: gtk-version.c ../src/lib/linux/firetray_x86_64-gcc4.so
	gcc $(includes_gdk_gtk) ../src/lib/linux/firetray_x86_64-gcc4.so -o gtk-version gtk-version.c
