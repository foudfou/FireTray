includes := $(shell pkg-config --libs --cflags gtk+-2.0)

.PHONY: all
all: gtk_icon_example trayicon hide

.PHONY: clean
clean:
	rm gtk_icon_example trayicon hide

gtk_icon_example: gtk_icon_example.c
	gcc $(includes) -o gtk_icon_example gtk_icon_example.c

trayicon: trayicon.c
	gcc $(includes) -o trayicon trayicon.c

hide: hide.c
	gcc $(includes) -o hide hide.c
