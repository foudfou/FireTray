#include <stdio.h>
#include <stdlib.h>
#include "../src/lib/linux/firetray.h"

int main(int argc, char** argv) {
  printf("gtk version: %d.%d.%d\n",
         gtk_get_major_version(),
         gtk_get_minor_version(),
         gtk_get_micro_version()
    );

  return(EXIT_SUCCESS);
}
